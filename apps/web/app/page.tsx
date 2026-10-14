import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  SlidersHorizontal,
  BadgeCheck,
} from "lucide-react";
import { Catalogue } from "../components/Catalogue";
export default function Home() {
  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src="/hero.png"
          alt="Illustrative silver concept crossover in a warm architectural setting"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="hero-kicker">
            <span />
            YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            Find your
            <br />
            next chapter.
          </h1>
          <p>
            More clarity. More possibility.
            <br />A car that feels like you.
          </p>
          <Link href="/explore" className="button light">
            Explore cars <ArrowRight size={20} />
          </Link>
        </div>
        <div className="hero-bottom">
          <span>INDEPENDENT THINKING. INFORMED CHOICES.</span>
          <span>Illustrative concept vehicle</span>
        </div>
      </section>
      <section className="section home-discovery">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A SMARTER WAY TO BUY</p>
            <h2>
              A clearer road
              <br className="mobile-break" /> to your next car.
            </h2>
          </div>
          <p>
            Explore, compare and plan with confidence.
            <br />
            Built for India. Driven by your needs.
          </p>
        </div>
        <Catalogue compact />
      </section>
      <section className="journey-section section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR JOURNEY, REIMAGINED</p>
            <h2>
              Good decisions start
              <br />
              with the right questions.
            </h2>
          </div>
          <Link href="/about" className="text-link">
            Our approach <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="journey-grid">
          <Link href="/advisor" className="journey-item">
            <Compass strokeWidth={1.2} size={32} />
            <span className="step-number">01 / DISCOVER</span>
            <h3>Made for your life.</h3>
            <p>
              Your budget, your everyday needs, your priorities. Find a
              considered starting point.
            </p>
            <span className="text-link">
              Meet your car advisor <ArrowRight size={18} />
            </span>
          </Link>
          <Link href="/showroom" className="journey-item">
            <SlidersHorizontal strokeWidth={1.2} size={32} />
            <span className="step-number">02 / EXPLORE</span>
            <h3>A closer look.</h3>
            <p>
              Explore original, unbranded concept assets in true 3D. Every
              detail, at your own pace.
            </p>
            <span className="text-link">
              Enter the showroom <ArrowRight size={18} />
            </span>
          </Link>
          <Link href="/finance" className="journey-item">
            <BadgeCheck strokeWidth={1.2} size={32} />
            <span className="step-number">03 / PLAN</span>
            <h3>See the whole picture.</h3>
            <p>
              Understand monthly payments and ownership costs before taking your
              next step.
            </p>
            <span className="text-link">
              Plan your budget <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      </section>
      <section className="confidence-band">
        <p className="eyebrow">CONFIDENCE COMES FROM CLARITY</p>
        <h2>
          Your next car.
          <br />
          Your informed choice.
        </h2>
        <p>
          Transparent sources. Considered recommendations.
          <br />
          No invented availability or promises.
        </p>
        <Link href="/advisor" className="button light">
          Find your starting point <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
