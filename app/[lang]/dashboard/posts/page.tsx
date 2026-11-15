import { requireShop } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import type { Field } from "@/lib/fields";
import { addPostFromLink } from "@/app/[lang]/dashboard/actions";
import { ResourceEditor } from "@/components/dashboard/ResourceEditor";
import { FieldsForm } from "@/components/forms/FieldsForm";

const LINK_FIELDS: Field[] = [
  { name: "url", label: { ckb: "لینکی پۆست", ar: "رابط المنشور", en: "Post link" }, type: "url", required: true, placeholder: "https://www.instagram.com/p/…" },
];

export default async function PostsPage() {
  const [, { t }] = await Promise.all([requireShop(["owner", "manager"]), getI18n()]); // staff logins can't open this page
  const p = t.dashboard.postLink;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t.dashboard.posts.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.dashboard.posts.help}</p>
      </div>
      {/* Paste a link: the image and text come by themselves (lib/safe-fetch.server.ts). */}
      <section className="card space-y-3">
        <h2 className="font-bold">{p.title}</h2>
        <p className="text-sm text-slate-500">{p.help}</p>
        <FieldsForm action={addPostFromLink} fields={LINK_FIELDS} submitLabel={p.submit} columns={1} />
      </section>
      <ResourceEditor resource="posts" />
    </div>
  );
}
