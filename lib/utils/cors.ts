export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  // Chrome 扩展跨域 POST 会带 Authorization；须与预检 Access-Control-Request-Headers 对齐
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-crow-llm-config',
  // 让跨域调用方（扩展）能读到实际生效的 provider，用于自配 API「测试连接」
  'Access-Control-Expose-Headers': 'x-crow-provider',
};

export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
