export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  // Chrome 扩展跨域 POST 会带 Authorization；须与预检 Access-Control-Request-Headers 对齐
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
};

export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
