import { PageHeader } from "@/components/common/PageHeader"
import { Button } from "@/components/ui/button"

export function HomePage() {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-12">
      <PageHeader
        title="Frontend container ready"
        description="React + Vite + TypeScript + Tailwind + shadcn/ui is configured for large-scale development."
      />

      <div className="flex flex-wrap gap-3">
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
      </div>
    </section>
  )
}
