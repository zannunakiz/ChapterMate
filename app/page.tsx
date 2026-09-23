import { PageMotion } from "@/components/landing/page-motion"
import { Navigation } from "@/components/landing/navigation"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import {
  HowItWorksSection,
  LibrarySection
} from "@/components/landing/how-it-works-section"
import { CtaSection } from "@/components/landing/cta-section"
import { FooterSection } from "@/components/landing/footer-section"

export default function Home() {
  return (
    <PageMotion>
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <LibrarySection />
      <CtaSection />
      <FooterSection />
    </PageMotion>
  )
}
