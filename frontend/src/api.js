const REQUEST_TIMEOUT_MS = 6000;

export class ApiError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;         // 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PARSE'
    this.cause = cause;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    let body = null;
    try {
      body = await response.json();
    } catch (e) {
      if (!response.ok) throw new ApiError('服务器响应格式错误', { status: response.status, code: 'PARSE' });
    }

    if (!response.ok) {
      throw new ApiError(
        body?.message || `请求失败（${response.status}）`,
        { status: response.status, code: 'HTTP' },
      );
    }
    return body;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('网络请求超时，请检查网络后重试', { code: 'TIMEOUT', cause: err });
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || '网络异常，请稍后重试', { code: 'NETWORK', cause: err });
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  menu: () => request('/api/demo/menu'),
  cart: sessionId => request(`/api/demo/cart?sessionId=${encodeURIComponent(sessionId)}`),
  setCartItem: payload => request('/api/demo/cart/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  checkoutPreview: (sessionId, dishIds = []) => request('/api/demo/checkout/preview', {
    method: 'POST',
    body: JSON.stringify({ sessionId, dishIds }),
  }),
};
