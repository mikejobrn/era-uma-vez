import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1
        className="text-5xl font-bold text-center"
        style={{ color: "var(--color-dourado)", fontFamily: "var(--font-pirata-one), cursive" }}
      >
        Era Uma Vez
      </h1>
      <p className="text-center text-lg opacity-80 max-w-sm">
        Escolha como entrar na história:
      </p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/mesa"
          className="w-full text-center py-4 px-6 rounded-lg text-lg font-semibold transition-colors"
          style={{
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
          }}
        >
          🖥️ Abrir Mesa (iPad)
        </Link>
        <Link
          href="/mao"
          className="w-full text-center py-4 px-6 rounded-lg text-lg font-semibold border-2 transition-colors"
          style={{
            borderColor: "var(--color-dourado)",
            color: "var(--color-dourado)",
          }}
        >
          📱 Entrar como Jogador
        </Link>
      </div>
    </main>
  );
}
