// The home page as one scroll journey, scene by scene.
"use client";
import { PreloaderScene } from "./s0-preloader";
import { HeroScene } from "./s1-hero";
import { StatementScene } from "./s2-statement";
import { LeftoversScene } from "./s3-leftovers";
import { VerbsScene } from "./s4-verbs";
import { JourneyScene } from "./s5-journey";
import { CheckNightScene } from "./s6-check";
import { FooterDomeScene } from "./s7-footer";

export function HomeScenes() {
  return (
    <div className="home-journey">
      <PreloaderScene />
      <HeroScene />
      <StatementScene />
      <LeftoversScene />
      <VerbsScene />
      <JourneyScene />
      <CheckNightScene />
      <FooterDomeScene />
    </div>
  );
}
