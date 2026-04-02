import { redirect } from "next/navigation";

export default function Home() {
  // Root page redirects to settings (embedded in Shopify Admin)
  redirect("/settings");
}
