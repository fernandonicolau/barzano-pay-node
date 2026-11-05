# Changelog

## 0.10.0 — preparada, ainda não publicada

- adiciona o fluxo de cartão hospedado com `creditCard.flow = 'REDIRECT'`;
- adiciona `nextAction.type = 'REDIRECT'` para abrir a página segura do provider;
- mantém cartão tokenizado do Mercado Pago e cartão criptografado do PagBank tipados;
- mantém vencimentos humanos para PIX e boleto;
- atualiza exemplos e tipos sem expor PAN, CVV ou credenciais de provider.

Esta versão deve ser publicada somente depois dos testes sandbox de cartão e da aprovação do pacote
gerado por `npm pack --dry-run`.
