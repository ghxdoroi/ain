class CorreiosCheckout {
  constructor() {
    this.paymentStatus = "loading"
    this.timeLeft = 15 * 60 // 15 minutos em segundos
    this.pixPayment = null
    this.statusCheckInterval = null

    // Configurar API PIX - ALTERE AQUI SUAS CREDENCIAIS
    const PixAPI = window.PixAPI // Assuming PixAPI is globally available
    const GATEWAY_CONFIGS = window.GATEWAY_CONFIGS // Assuming GATEWAY_CONFIGS is globally available
    this.pixAPI = new PixAPI(GATEWAY_CONFIGS.mercadopago) // ou pagseguro, asaas, gerencianet

    this.init()
  }

  async init() {
    this.bindEvents()
    await this.createPixPayment()
  }

  bindEvents() {
    // Copy PIX code
    const copyBtn = document.getElementById("copyBtn")
    copyBtn.addEventListener("click", () => this.copyPixCode())

    // Retry button
    const retryBtn = document.getElementById("retryBtn")
    retryBtn.addEventListener("click", () => this.retryPayment())

    // Menu button (placeholder)
    const menuBtn = document.getElementById("menuBtn")
    menuBtn.addEventListener("click", () => {
      console.log("Menu clicked")
    })

    // Accessibility button (placeholder)
    const accessibilityBtn = document.getElementById("accessibilityBtn")
    accessibilityBtn.addEventListener("click", () => {
      console.log("Accessibility clicked")
    })
  }

  async createPixPayment() {
    try {
      this.updatePaymentStatus("loading")

      // Dados do pedido
      const orderData = {
        amount: 28.0,
        description: "Frete Expresso Correios",
        payer_name: "Cliente Correios",
        payer_email: "cliente@exemplo.com",
        payer_document: "12345678901",
        external_reference: `CORREIOS_${Date.now()}`,
      }

      console.log("Criando pagamento PIX...")
      this.pixPayment = await this.pixAPI.createPixPayment(orderData)

      console.log("Pagamento PIX criado:", this.pixPayment)

      // Atualizar interface
      this.updatePixInterface()
      this.updatePaymentStatus("pending")
      this.startTimer()
      this.startStatusCheck()
    } catch (error) {
      console.error("Erro ao criar pagamento PIX:", error)
      this.showError("Erro ao gerar PIX: " + error.message)
    }
  }

  updatePixInterface() {
    if (!this.pixPayment) return

    // Atualizar código PIX
    const pixCodeElement = document.getElementById("pixCode")
    pixCodeElement.textContent = this.pixPayment.pix_code || "Código PIX não disponível"

    // Atualizar QR Code
    const qrCodeImage = document.getElementById("qrCodeImage")
    if (this.pixPayment.qr_code_base64) {
      qrCodeImage.innerHTML = `<img src="data:image/png;base64,${this.pixPayment.qr_code_base64}" alt="QR Code PIX" />`
    } else if (this.pixPayment.qr_code) {
      // Gerar QR Code usando API externa (exemplo: qr-server.com)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(this.pixPayment.qr_code)}`
      qrCodeImage.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code PIX" />`
    }

    // Atualizar ID do pedido
    const orderIdElement = document.getElementById("orderId")
    orderIdElement.textContent = `ID: ${this.pixPayment.id}`
  }

  startTimer() {
    if (this.paymentStatus !== "pending") return

    const timerInterval = setInterval(() => {
      if (this.timeLeft > 0 && this.paymentStatus === "pending") {
        this.timeLeft--
        this.updateTimerDisplay()
      } else {
        clearInterval(timerInterval)
        if (this.paymentStatus === "pending") {
          this.showError("PIX expirado. Gere um novo pagamento.")
        }
      }
    }, 1000)
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeLeft / 60)
    const seconds = this.timeLeft % 60
    const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    const timerText = document.getElementById("timerText")
    timerText.textContent = `Expira em: ${formattedTime}`
  }

  startStatusCheck() {
    if (!this.pixPayment) return

    // Verificar status a cada 5 segundos
    this.statusCheckInterval = setInterval(async () => {
      try {
        const statusData = await this.pixAPI.getPaymentStatus(this.pixPayment.id)
        console.log("Status do pagamento:", statusData)

        if (statusData.status === "approved" || statusData.status === "paid") {
          this.updatePaymentStatus("completed")
          clearInterval(this.statusCheckInterval)
        } else if (statusData.status === "cancelled" || statusData.status === "expired") {
          this.showError("Pagamento cancelado ou expirado")
          clearInterval(this.statusCheckInterval)
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error)
      }
    }, 5000)
  }

  async copyPixCode() {
    if (!this.pixPayment?.pix_code) {
      this.showToast("Código PIX não disponível", "error")
      return
    }

    try {
      await navigator.clipboard.writeText(this.pixPayment.pix_code)

      // Update button icon
      const copyIcon = document.getElementById("copyIcon")
      const copyBtn = document.getElementById("copyBtn")

      copyIcon.className = "fas fa-check"
      copyBtn.classList.add("copied")

      // Show toast
      this.showToast("Código PIX copiado!", "success")

      // Reset button after 2 seconds
      setTimeout(() => {
        copyIcon.className = "fas fa-copy"
        copyBtn.classList.remove("copied")
      }, 2000)
    } catch (err) {
      console.error("Erro ao copiar:", err)
      this.showToast("Erro ao copiar código PIX", "error")
    }
  }

  async retryPayment() {
    await this.createPixPayment()
  }

  showToast(message, type = "success") {
    const toast = document.getElementById("toast")
    const toastTitle = document.getElementById("toastTitle")
    const toastMessage = document.getElementById("toastMessage")

    toastTitle.textContent = type === "success" ? "Sucesso!" : "Erro!"
    toastMessage.textContent = message

    toast.className = `toast show ${type === "error" ? "error" : ""}`

    setTimeout(() => {
      toast.classList.remove("show")
    }, 4000)
  }

  showError(message) {
    this.updatePaymentStatus("error")
    const errorMessage = document.getElementById("errorMessage")
    errorMessage.textContent = message
  }

  updatePaymentStatus(newStatus) {
    this.paymentStatus = newStatus

    const statusBadge = document.getElementById("statusBadge")
    const timerText = document.getElementById("timerText")
    const loadingCard = document.getElementById("loadingCard")
    const pixCard = document.getElementById("pixCard")
    const processingCard = document.getElementById("processingCard")
    const successCard = document.getElementById("successCard")
    const errorCard = document.getElementById("errorCard")

    // Reset all cards
    loadingCard.classList.add("hidden")
    pixCard.classList.add("hidden")
    processingCard.classList.add("hidden")
    successCard.classList.add("hidden")
    errorCard.classList.add("hidden")

    switch (newStatus) {
      case "loading":
        statusBadge.textContent = "Gerando PIX..."
        statusBadge.className = "status-badge"
        timerText.textContent = "Carregando..."
        loadingCard.classList.remove("hidden")
        break

      case "pending":
        statusBadge.textContent = "Aguardando pagamento"
        statusBadge.className = "status-badge"
        timerText.textContent = `Expira em: ${this.formatTime(this.timeLeft)}`
        pixCard.classList.remove("hidden")
        break

      case "processing":
        statusBadge.textContent = "Processando pagamento"
        statusBadge.className = "status-badge processing"
        timerText.textContent = "Processando..."
        processingCard.classList.remove("hidden")
        break

      case "completed":
        statusBadge.textContent = "Pagamento aprovado"
        statusBadge.className = "status-badge completed"
        timerText.textContent = "Concluído"
        successCard.classList.remove("hidden")

        // Gerar código de rastreamento
        const trackingCode = document.getElementById("trackingCode")
        trackingCode.textContent = `BR${Math.random().toString().substr(2, 9)}CR`
        break

      case "error":
        statusBadge.textContent = "Erro no pagamento"
        statusBadge.className = "status-badge error"
        timerText.textContent = "Erro"
        errorCard.classList.remove("hidden")
        break
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new CorreiosCheckout()
})
