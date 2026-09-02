import Machine from "@/components/Machine";

type HomeProps = {
  searchParams: Promise<{
    p?: string;
    a?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const product = typeof params.p === "string" ? params.p.trim() : "";
  const audience = typeof params.a === "string" ? params.a.trim() : "";
  const shared =
    product &&
    audience &&
    product.length <= 60 &&
    audience.length <= 60 &&
    !/[\r\n]/.test(product) &&
    !/[\r\n]/.test(audience)
      ? { product, audience }
      : undefined;

  return <Machine sharedResult={shared} />;
}
