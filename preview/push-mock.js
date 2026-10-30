// Notificação push simulada: o interruptor só liga/desliga o aviso na caixa de mensagens da moldura.

const KEY = 'petlee.preview.push';
const read = () => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ok */
  }
};

export const pushSupported = () => true;
export const pushStatus = async () => (read() ? 'enabled' : 'available');
export async function enablePush() {
  write('on');
  return true;
}
export async function disablePush() {
  write('off');
}
