import Machine from "@/components/Machine";

type HomeProps = {
  searchParams: Promise<{
    p?: string;
    a?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const shared =
    typeof params.p === "string" &&
    typeof params.a === "string" &&
    params.p.trim() &&
    params.a.trim()
      ? { product: params.p.trim(), audience: params.a.trim() }
      : undefined;

  return <Machine sharedResult={shared} />;
}
