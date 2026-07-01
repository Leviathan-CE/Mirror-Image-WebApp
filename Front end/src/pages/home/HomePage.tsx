import { PageHeader } from "@/components/common/PageHeader"
import { Button } from "@/components/ui/button"

// Edit only this line to change the home background.
//do not edit directly will break you keyboard don't know why
// Files live in: Front end/public/images/
const HOME_BACKGROUND_IMAGE = "/images/Zone-32B.png"

export function HomePage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-6 py-12"
      style={{ backgroundImage: `url(${HOME_BACKGROUND_IMAGE})` }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden />

      <div className=" font-buahs93 text-cyan-300 relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8">
        <PageHeader
          title="MIRRORIMGE THE CRPCG"
          description={
            <>
              In the <span className="italic">MIRRORIMAGE</span> Collectable Role
              playing Card Game, you will iether choose or create a pilot
               character and equip them with augments to enhance yourself
                of your squad of units, cyberpsells and thuamatechnolgies, and enter
                into the fight an opposing pilot(s) and monsters, to fight for freedom
                , tyriny, or to the highest bidder, at the end of the world. Featuring 
                a blend of artwork and real horrors only a machine can think of
                 the <span className="italic">MIRRORIMAGE</span> is designed for trading card players,
                 respecable collectors, roleplaying RPG enthusiats, and 
                 those intrested in new ideas and fresh unique look on a 
                 fantasypunk genre. Set on a planet ravenged by thousands of years of war now
                 on the brink of destruction, by a resurgence of a feared rouge AI shadow goverment, once
                 defeated at great cost returns to finished its ruthless conquest for control.

            </>
          }
        />

        <div className="flex flex-wrap gap-3">
          <Button>Primary Action</Button>
          <Button variant="outline">Secondary Action</Button>
        </div>
      </div>
    </section>
  )
}
