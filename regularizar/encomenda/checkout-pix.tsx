"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Check, Clock, Package, QrCode } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function Component() {
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "processing" | "completed">("pending")
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutos em segundos
  const { toast } = useToast()

  // Código PIX simulado
  const pixCode =
    "00020126580014br.gov.bcb.pix013636c4c14e-1234-4321-abcd-1234567890ab5204000053039865802BR5925EMPRESA CORREIOS LTDA6009SAO PAULO62070503***6304A1B2"

  // Timer para expiração do PIX
  useEffect(() => {
    if (timeLeft > 0 && paymentStatus === "pending") {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft, paymentStatus])

  // Simular verificação de pagamento
  useEffect(() => {
    if (paymentStatus === "pending") {
      const checkPayment = setTimeout(() => {
        // Simula mudança de status após 10 segundos
        setPaymentStatus("processing")
        setTimeout(() => setPaymentStatus("completed"), 3000)
      }, 10000)
      return () => clearTimeout(checkPayment)
    }
  }, [paymentStatus])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixCode)
      setCopied(true)
      toast({
        title: "Código PIX copiado!",
        description: "Cole no seu app de pagamento para finalizar a compra.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Tente selecionar e copiar manualmente.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = () => {
    switch (paymentStatus) {
      case "pending":
        return "bg-yellow-500"
      case "processing":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
    }
  }

  const getStatusText = () => {
    switch (paymentStatus) {
      case "pending":
        return "Aguardando pagamento"
      case "processing":
        return "Processando pagamento"
      case "completed":
        return "Pagamento aprovado"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header Oficial dos Correios */}
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-200 rounded">
                <div className="space-y-1">
                  <div className="w-5 h-0.5 bg-[#003d82]"></div>
                  <div className="w-5 h-0.5 bg-[#003d82]"></div>
                  <div className="w-5 h-0.5 bg-[#003d82]"></div>
                </div>
              </button>
              <button className="flex items-center gap-1 text-[#0066cc] text-sm hover:underline">
                Acessibilidade
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0066cc] rounded-full flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="text-[#003d82] font-bold text-lg">Correios</span>
            </div>
          </div>
          <div className="h-2 bg-[#ffcc00]"></div>
        </div>

        {/* Título da página */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-[#003d82]">Checkout Seguro</h1>
          <p className="text-sm text-gray-600">Finalize seu pagamento via PIX</p>
        </div>

        {/* Status do Pagamento */}
        <Card className="border-2 border-[#003d82]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#003d82]">Status do Pedido</CardTitle>
              <Badge className={`${getStatusColor()} text-white`}>{getStatusText()}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                {paymentStatus === "pending" ? `Expira em: ${formatTime(timeLeft)}` : "Processando..."}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Pedido */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[#003d82]">Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Frete Expresso</span>
              <span>R$ 25,90</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de processamento</span>
              <span>R$ 2,10</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[#003d82]">R$ 28,00</span>
            </div>
          </CardContent>
        </Card>

        {/* PIX Payment */}
        {paymentStatus === "pending" && (
          <Card className="border-2 border-[#ffcc00]">
            <CardHeader className="text-center">
              <CardTitle className="text-[#003d82] flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5" />
                Pagamento PIX
              </CardTitle>
              <CardDescription>Escaneie o QR Code ou copie o código PIX</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code Placeholder */}
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">QR Code PIX</p>
                  </div>
                </div>
              </div>

              {/* Código PIX */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ou copie o código PIX:</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-gray-50 rounded-lg border text-xs font-mono break-all">{pixCode}</div>
                  <Button onClick={copyPixCode} variant="outline" size="sm" className="shrink-0 bg-transparent">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-[#003d82]">
                  <strong>Como pagar:</strong>
                </p>
                <ol className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>1. Abra seu app de banco</li>
                  <li>2. Escolha a opção PIX</li>
                  <li>3. Escaneie o QR Code ou cole o código</li>
                  <li>4. Confirme o pagamento</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status de Processamento */}
        {paymentStatus === "processing" && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
                <div>
                  <h3 className="font-semibold text-[#003d82]">Processando pagamento...</h3>
                  <p className="text-sm text-gray-600">Aguarde alguns instantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagamento Aprovado */}
        {paymentStatus === "completed" && (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800">Pagamento Aprovado!</h3>
                  <p className="text-sm text-gray-600">Seu pedido foi confirmado</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-sm">
                    <strong>Código de rastreamento:</strong>
                  </p>
                  <p className="font-mono text-[#003d82]">BR123456789CR</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pb-4">
          <p>Pagamento processado com segurança</p>
          <p className="mt-1">Correios - Conectando o Brasil</p>
        </div>
      </div>
    </div>
  )
}
