import { ArrowLeft, Shield, FileText, Globe } from 'lucide-react';

interface PoliciesViewProps {
  onBack: () => void;
}

export function PoliciesView({ onBack }: PoliciesViewProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C576B] hover:text-[#161320]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Store</span>
      </button>

      <h1 className="mt-6 font-display text-3xl font-extrabold text-[#161320]">
        Licensing, Privacy &amp; International Terms
      </h1>
      <p className="mt-2 text-sm text-[#5C576B]">
        Fox Boy's 3D Assets serves independent creators and studios across the United States, Canada, the United Kingdom, Europe, Asia, and worldwide in USD.
      </p>

      <div className="mt-8 space-y-8">
        <section className="rounded-xl border border-[#E6E2F0] bg-white p-6">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-[#6D4BB3]" />
            <h2 className="font-display text-xl font-bold text-[#161320]">
              Standard Commercial &amp; Game Asset License
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#5C576B]">
            <p>
              <strong className="text-[#161320]">Permitted Uses:</strong> Every paid or free asset acquired from Fox Boy's 3D Assets grants you a non-exclusive, worldwide, royalty-free license to modify, texture, and incorporate the 3D models into personal projects, commercial games, Roblox Studio experiences, Roblox UGC submissions (for UGC-designated items), Unity/Unreal/Godot games, and promotional game media.
            </p>
            <p>
              <strong className="text-[#161320]">Strict Restrictions:</strong> You may NOT resell, redistribute, share, or upload the raw source files (.BLEND, .FBX, .OBJ, .RBXM, .RBXMX, .ZIP) as standalone assets, asset packs, or competing marketplace listings, even if modified.
            </p>
            <p>
              <strong className="text-[#161320]">Updates:</strong> When Fox Boy's 3D Assets uploads improved topology, textures, or new file formats for an asset you own, updated versions automatically appear inside your Account Library.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-[#E6E2F0] bg-white p-6">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-[#6D4BB3]" />
            <h2 className="font-display text-xl font-bold text-[#161320]">
              Privacy &amp; Digital Delivery Security
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#5C576B]">
            <p>
              We collect only the account information required to authenticate your library, process USD purchases via Shopify, and deliver your protected digital downloads.
            </p>
            <p>
              Payment card details are handled exclusively by Shopify and eligible international payment processors; Fox Boy's 3D Assets never stores raw payment card numbers. Download links are user-bound and token-protected so third parties cannot access your purchased files.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-[#E6E2F0] bg-white p-6">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-[#6D4BB3]" />
            <h2 className="font-display text-xl font-bold text-[#161320]">
              Digital Goods Refund &amp; Support Policy
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#5C576B]">
            <p>
              All prices are billed in United States Dollars (USD). Because digital 3D models are delivered immediately upon payment confirmation, completed downloads are generally non-refundable unless a file is technically defective and cannot be resolved by our team.
            </p>
            <p>
              Need format assistance or encountered an import issue in Roblox Studio or Blender? Open a ticket anytime from your Account Support tab.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
