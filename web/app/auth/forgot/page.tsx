import Link from 'next/link';

import { sendPasswordReset } from '../actions';

type Params = Promise<{ message?: string; sent?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  return <main className="center-page"><section className="auth-card compact-card">
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1>
    <p className="muted">Enter your account email. If it matches an account, Card Nest will send a secure reset link.</p>
    {params.sent ? <div className="notice success" role="status">Check your inbox for your Card Nest password reset link.</div> : null}
    {params.message ? <div className="notice" role="alert">{params.message}</div> : null}
    <form action={sendPasswordReset} className="form-stack"><label>Email address<input autoComplete="email" name="email" required type="email" /></label><button className="button button-primary">Send reset link</button></form>
    <Link className="text-link" href="/auth?mode=signin">Back to login</Link>
  </section></main>;
}
