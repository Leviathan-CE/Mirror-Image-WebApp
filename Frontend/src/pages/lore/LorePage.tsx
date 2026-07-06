import { sharedImages } from "@/assets/shared";

import type { Note, Section, TableOfContents, Term, TocEntry } from "@/components/docs";



const SECTIONS: TocEntry[] = [
{id:"01", label:"Introduction"},
]

export function LorePage(){
    return(
        <section
        className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
        style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
      >
         <div className="absolute inset-0 bg-black/60" aria-hidden />


        </section>
    )
}
