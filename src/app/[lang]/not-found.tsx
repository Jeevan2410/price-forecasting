import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid gap-3 pt-16 text-center">
      <p className="text-5xl font-semibold text-muted">404</p>
      <h1 className="text-xl font-semibold">Page not found · ಪುಟ ಸಿಗಲಿಲ್ಲ</h1>
      <p>
        <Link href="/en" className="text-accent underline">
          Markets
        </Link>{" "}
        ·{" "}
        <Link href="/kn" className="text-accent underline">
          ಮಾರುಕಟ್ಟೆಗಳು
        </Link>
      </p>
    </div>
  );
}
