/**
 * PIX API Integration
 * Suporta múltiplos gateways de pagamento
 */

class PixAPI {
  constructor(config = {}) {
    this.config = {
      gateway: config.gateway || "mercadopago", // mercadopago, pagseguro, asaas, gerencianet
      environment: config.environment || "sandbox", // sandbox, production
      credentials: config.credentials || {},
      webhook_url: config.webhook_url || null,
      ...config,
    }

    this.baseUrls = {
      mercadopago: {
        sandbox: "https://api.mercadopago.com",
        production: "https://api.mercadopago.com",
      },
      pagseguro: {
        sandbox: "https://ws.sandbox.pagseguro.uol.com.br",
        production: "https://ws.pagseguro.uol.com.br",
      },
      asaas: {
        sandbox: "https://sandbox.asaas.com/api/v3",
        production: "https://api.asaas.com/v3",
      },
      gerencianet: {
        sandbox: "https://api-pix-h.gerencianet.com.br",
        production: "https://api-pix.gerencianet.com.br",
      },
    }
  }

  /**
   * Cria um pagamento PIX
   */
  async createPixPayment(orderData) {
    try {
      switch (this.config.gateway) {
        case "mercadopago":
          return await this.createMercadoPagoPixPayment(orderData)
        case "pagseguro":
          return await this.createPagSeguroPixPayment(orderData)
        case "asaas":
          return await this.createAsaasPixPayment(orderData)
        case "gerencianet":
          return await this.createGerenciaNetPixPayment(orderData)
        default:
          throw new Error(`Gateway ${this.config.gateway} não suportado`)
      }
    } catch (error) {
      console.error("Erro ao criar pagamento PIX:", error)
      throw error
    }
  }

  /**
   * Mercado Pago PIX
   */
  async createMercadoPagoPixPayment(orderData) {
    const baseUrl = this.baseUrls.mercadopago[this.config.environment]

    const paymentData = {
      transaction_amount: orderData.amount,
      description: orderData.description || "Pagamento Correios",
      payment_method_id: "pix",
      payer: {
        email: orderData.payer_email || "cliente@correios.com.br",
        first_name: orderData.payer_name || "Cliente",
        identification: {
          type: "CPF",
          number: orderData.payer_document || "00000000000",
        },
      },
      notification_url: this.config.webhook_url,
      external_reference: orderData.external_reference || `CORREIOS_${Date.now()}`,
    }

    const response = await fetch(`${baseUrl}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.credentials.access_token}`,
        "X-Idempotency-Key": this.generateIdempotencyKey(),
      },
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Mercado Pago Error: ${error.message || "Erro desconhecido"}`)
    }

    const payment = await response.json()

    return {
      id: payment.id,
      status: payment.status,
      qr_code: payment.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
      pix_code: payment.point_of_interaction?.transaction_data?.qr_code,
      expires_at: payment.date_of_expiration,
      amount: payment.transaction_amount,
      gateway: "mercadopago",
      external_reference: payment.external_reference,
    }
  }

  /**
   * PagSeguro PIX
   */
  async createPagSeguroPixPayment(orderData) {
    const baseUrl = this.baseUrls.pagseguro[this.config.environment]

    const paymentData = {
      reference_id: orderData.external_reference || `CORREIOS_${Date.now()}`,
      customer: {
        name: orderData.payer_name || "Cliente Correios",
        email: orderData.payer_email || "cliente@correios.com.br",
        tax_id: orderData.payer_document || "00000000000",
      },
      items: [
        {
          reference_id: "FRETE_001",
          name: orderData.description || "Frete Correios",
          quantity: 1,
          unit_amount: Math.round(orderData.amount * 100), // centavos
        },
      ],
      qr_codes: [
        {
          amount: {
            value: Math.round(orderData.amount * 100),
          },
          expiration_date: this.getExpirationDate(15), // 15 minutos
        },
      ],
      notification_urls: this.config.webhook_url ? [this.config.webhook_url] : [],
    }

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.credentials.access_token}`,
      },
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`PagSeguro Error: ${error.error_messages?.[0]?.description || "Erro desconhecido"}`)
    }

    const order = await response.json()
    const qrCode = order.qr_codes?.[0]

    return {
      id: order.id,
      status: "pending",
      qr_code: qrCode?.text,
      qr_code_base64: null, // PagSeguro não retorna base64 diretamente
      pix_code: qrCode?.text,
      expires_at: qrCode?.expiration_date,
      amount: orderData.amount,
      gateway: "pagseguro",
      external_reference: order.reference_id,
    }
  }

  /**
   * Asaas PIX
   */
  async createAsaasPixPayment(orderData) {
    const baseUrl = this.baseUrls.asaas[this.config.environment]

    const paymentData = {
      customer: orderData.customer_id || (await this.createAsaasCustomer(orderData)),
      billingType: "PIX",
      value: orderData.amount,
      dueDate: this.getExpirationDate(15, "YYYY-MM-DD"),
      description: orderData.description || "Pagamento Correios",
      externalReference: orderData.external_reference || `CORREIOS_${Date.now()}`,
    }

    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: this.config.credentials.api_key,
      },
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Asaas Error: ${error.errors?.[0]?.description || "Erro desconhecido"}`)
    }

    const payment = await response.json()

    // Buscar informações do PIX
    const pixResponse = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: {
        access_token: this.config.credentials.api_key,
      },
    })

    let pixData = null
    if (pixResponse.ok) {
      pixData = await pixResponse.json()
    }

    return {
      id: payment.id,
      status: payment.status.toLowerCase(),
      qr_code: pixData?.payload,
      qr_code_base64: pixData?.encodedImage,
      pix_code: pixData?.payload,
      expires_at: payment.dueDate,
      amount: payment.value,
      gateway: "asaas",
      external_reference: payment.externalReference,
    }
  }

  /**
   * Gerencianet PIX
   */
  async createGerenciaNetPixPayment(orderData) {
    const baseUrl = this.baseUrls.gerencianet[this.config.environment]

    // Primeiro, criar a cobrança
    const chargeData = {
      calendario: {
        expiracao: 900, // 15 minutos
      },
      devedor: {
        cpf: orderData.payer_document || "00000000000",
        nome: orderData.payer_name || "Cliente Correios",
      },
      valor: {
        original: orderData.amount.toFixed(2),
      },
      chave: this.config.credentials.pix_key,
      solicitacaoPagador: orderData.description || "Pagamento Correios",
    }

    const txid = this.generateTxId()

    const response = await fetch(`${baseUrl}/v2/cob/${txid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await this.getGerenciaNetToken()}`,
      },
      body: JSON.stringify(chargeData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gerencianet Error: ${error.detail || "Erro desconhecido"}`)
    }

    const charge = await response.json()

    // Gerar QR Code
    const qrResponse = await fetch(`${baseUrl}/v2/loc/${charge.loc.id}/qrcode`, {
      headers: {
        Authorization: `Bearer ${await this.getGerenciaNetToken()}`,
      },
    })

    let qrData = null
    if (qrResponse.ok) {
      qrData = await qrResponse.json()
    }

    return {
      id: charge.txid,
      status: charge.status.toLowerCase(),
      qr_code: qrData?.qrcode,
      qr_code_base64: qrData?.imagemQrcode,
      pix_code: qrData?.qrcode,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      amount: orderData.amount,
      gateway: "gerencianet",
      external_reference: txid,
    }
  }

  /**
   * Consulta status do pagamento
   */
  async getPaymentStatus(paymentId) {
    try {
      switch (this.config.gateway) {
        case "mercadopago":
          return await this.getMercadoPagoPaymentStatus(paymentId)
        case "pagseguro":
          return await this.getPagSeguroPaymentStatus(paymentId)
        case "asaas":
          return await this.getAsaasPaymentStatus(paymentId)
        case "gerencianet":
          return await this.getGerenciaNetPaymentStatus(paymentId)
        default:
          throw new Error(`Gateway ${this.config.gateway} não suportado`)
      }
    } catch (error) {
      console.error("Erro ao consultar status do pagamento:", error)
      throw error
    }
  }

  /**
   * Métodos auxiliares
   */
  generateIdempotencyKey() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  generateTxId() {
    return Math.random().toString(36).substr(2, 32).toUpperCase()
  }

  getExpirationDate(minutes, format = "ISO") {
    const date = new Date(Date.now() + minutes * 60 * 1000)

    if (format === "YYYY-MM-DD") {
      return date.toISOString().split("T")[0]
    }

    return date.toISOString()
  }

  async createAsaasCustomer(orderData) {
    const baseUrl = this.baseUrls.asaas[this.config.environment]

    const customerData = {
      name: orderData.payer_name || "Cliente Correios",
      email: orderData.payer_email || "cliente@correios.com.br",
      cpfCnpj: orderData.payer_document || "00000000000",
    }

    const response = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: this.config.credentials.api_key,
      },
      body: JSON.stringify(customerData),
    })

    if (!response.ok) {
      throw new Error("Erro ao criar cliente no Asaas")
    }

    const customer = await response.json()
    return customer.id
  }

  async getGerenciaNetToken() {
    // Implementar autenticação OAuth2 do Gerencianet
    // Por simplicidade, assumindo que o token já está configurado
    return this.config.credentials.access_token
  }

  // Métodos de consulta de status para cada gateway
  async getMercadoPagoPaymentStatus(paymentId) {
    const baseUrl = this.baseUrls.mercadopago[this.config.environment]

    const response = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.config.credentials.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error("Erro ao consultar status no Mercado Pago")
    }

    const payment = await response.json()
    return {
      status: payment.status,
      gateway: "mercadopago",
    }
  }

  async getPagSeguroPaymentStatus(paymentId) {
    const baseUrl = this.baseUrls.pagseguro[this.config.environment]

    const response = await fetch(`${baseUrl}/orders/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.config.credentials.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error("Erro ao consultar status no PagSeguro")
    }

    const order = await response.json()
    return {
      status: order.status.toLowerCase(),
      gateway: "pagseguro",
    }
  }

  async getAsaasPaymentStatus(paymentId) {
    const baseUrl = this.baseUrls.asaas[this.config.environment]

    const response = await fetch(`${baseUrl}/payments/${paymentId}`, {
      headers: {
        access_token: this.config.credentials.api_key,
      },
    })

    if (!response.ok) {
      throw new Error("Erro ao consultar status no Asaas")
    }

    const payment = await response.json()
    return {
      status: payment.status.toLowerCase(),
      gateway: "asaas",
    }
  }

  async getGerenciaNetPaymentStatus(paymentId) {
    const baseUrl = this.baseUrls.gerencianet[this.config.environment]

    const response = await fetch(`${baseUrl}/v2/cob/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${await this.getGerenciaNetToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Erro ao consultar status no Gerencianet")
    }

    const charge = await response.json()
    return {
      status: charge.status.toLowerCase(),
      gateway: "gerencianet",
    }
  }
}

// Configurações de exemplo para cada gateway
const GATEWAY_CONFIGS = {
  mercadopago: {
    gateway: "mercadopago",
    environment: "sandbox",
    credentials: {
      access_token: "TEST-1234567890-123456-abcdef1234567890abcdef1234567890-123456789",
    },
    webhook_url: "https://seu-site.com/webhook/mercadopago",
  },

  pagseguro: {
    gateway: "pagseguro",
    environment: "sandbox",
    credentials: {
      access_token: "your-pagseguro-token",
    },
    webhook_url: "https://seu-site.com/webhook/pagseguro",
  },

  asaas: {
    gateway: "asaas",
    environment: "sandbox",
    credentials: {
      api_key: "your-asaas-api-key",
    },
  },

  gerencianet: {
    gateway: "gerencianet",
    environment: "sandbox",
    credentials: {
      access_token: "your-gerencianet-token",
      pix_key: "sua-chave-pix@email.com",
    },
  },
}

// Exportar para uso global
window.PixAPI = PixAPI
window.GATEWAY_CONFIGS = GATEWAY_CONFIGS
