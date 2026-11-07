import {
  EmbeddedCardError,
  mountMercadoPagoCard,
  type EmbeddedCardController,
} from '../../src/browser.js';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error('CARD_EXAMPLE_INVALID_DOM');
  return element;
}

const publicKeyInput = requiredElement<HTMLInputElement>('#public-key');
const amountInput = requiredElement<HTMLInputElement>('#amount');
const renderButton = requiredElement<HTMLButtonElement>('#render');
const result = requiredElement<HTMLElement>('#result');

let controller: EmbeddedCardController | undefined;

function show(message: string, isError = false): void {
  result.textContent = message;
  result.classList.toggle('error', isError);
}

renderButton.addEventListener('click', async () => {
  const amountInReais = Number(amountInput.value.replace(',', '.'));
  const amount = Math.round(amountInReais * 100);
  if (!publicKeyInput.value.trim() || !Number.isFinite(amountInReais) || amount < 1) {
    show('Informe uma Public Key sandbox e um valor válido.', true);
    return;
  }

  renderButton.disabled = true;
  show('Carregando o formulário seguro do Mercado Pago...');
  try {
    await controller?.unmount();
    controller = await mountMercadoPagoCard({
      publicKey: publicKeyInput.value.trim(),
      containerId: 'mercado-pago-card',
      amount,
      onReady: () => show('Formulário pronto. Preencha e envie um cartão de teste.'),
      onSubmit: (safeResult) => show(JSON.stringify(safeResult, null, 2)),
      onError: (error) => show(`${error.code}: ${error.message}`, true),
    });
  } catch (error) {
    const safeError = error instanceof EmbeddedCardError
      ? error
      : new EmbeddedCardError('UNEXPECTED_ERROR', 'Não foi possível abrir o formulário seguro.');
    show(`${safeError.code}: ${safeError.message}`, true);
  } finally {
    renderButton.disabled = false;
  }
});
