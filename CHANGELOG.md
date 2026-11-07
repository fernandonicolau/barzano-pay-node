# Changelog

## 0.10.0 — preparada, ainda não publicada

- reserva `nextAction.type = 'REDIRECT'` para ações externas e checkout hospedado futuro;
- mantém o fluxo hospedado experimental fora das capabilities do MVP de delivery;
- separa o meio `CREDIT_CARD` da experiência `checkoutMode` (`EMBEDDED` ou `HOSTED`);
- mantém cartão tokenizado do Mercado Pago e cartão criptografado do PagBank tipados;
- adiciona o submódulo `@barzano/pay/browser` para o Brick do Mercado Pago e a criptografia do PagBank;
- normaliza os dois providers em um fragmento `creditCard` seguro para o backend do integrador;
- mantém vencimentos humanos para PIX e boleto;
- atualiza exemplos e tipos sem expor PAN, CVV ou credenciais de provider.

Esta versão deve ser publicada somente depois dos testes sandbox de cartão e da aprovação do pacote
gerado por `npm pack --dry-run`.
