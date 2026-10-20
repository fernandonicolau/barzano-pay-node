# Configuração assistida pelo CLI

Execute `npx @barzano/pay init` dentro do projeto que consumirá a Barzano Pay. A instalação do
pacote nunca inicia perguntas automaticamente, portanto instalações em CI continuam não interativas.

## Formas de autenticação

O CLI procura `BARZANO_PAY_API_KEY` primeiro nas variáveis do processo e depois no arquivo `.env`.
Quando encontra a chave, pula cadastro e login. Também é possível colar uma integration key durante
o assistente.

Sem uma chave, o assistente permite criar uma conta ou entrar em uma conta existente. No cadastro,
ele exige a confirmação do e-mail antes de continuar. O access token humano obtido no login fica
somente em memória, serve para criar uma integration key de sandbox e é descartado logo depois.

Se o usuário autorizar, o CLI grava no `.env`:

```dotenv
BARZANO_PAY_API_KEY=bp_sandbox_...
BARZANO_PAY_ENVIRONMENT=sandbox
BARZANO_STORE_ID=...
```

O CLI adiciona `.env` ao `.gitignore`. Credenciais do provedor de pagamento são enviadas diretamente
à API por campos ocultos e não são gravadas localmente.

## Comandos

```bash
npx @barzano/pay init
npx @barzano/pay doctor
npx @barzano/pay providers
```

`doctor` valida acesso à API, integration key, catálogo de provedores e lojas. `providers` lista os
provedores e meios de pagamento disponíveis dinamicamente. O assistente usa o esquema publicado pelo
backend para solicitar as credenciais exigidas por cada provedor.
