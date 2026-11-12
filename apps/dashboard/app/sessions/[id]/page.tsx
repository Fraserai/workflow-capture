import { redirect } from "next/navigation";

type SessionRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionRedirectPage({ params }: SessionRedirectPageProps) {
  const { id } = await params;
  redirect(`/app/captures?selected=${encodeURIComponent(id)}`);
}
