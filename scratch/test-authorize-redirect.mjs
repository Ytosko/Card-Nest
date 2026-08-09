const url = 'https://kncwnbxoynkxsckvnevb.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcardnest.ytosko.dev%2Fgauth%2Fcallback';

const response = await fetch(url, { redirect: 'manual' });
console.log('HTTP Status:', response.status);
console.log('Location header:', response.headers.get('location'));
