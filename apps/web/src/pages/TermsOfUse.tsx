import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = '22 February 2026';

export function TermsOfUse() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="border-4 border-black bg-card shadow-neo p-6 md:p-8 space-y-6">
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-black uppercase">Terms of Use</h1>
          <p className="font-medium">Effective date: {EFFECTIVE_DATE}</p>
          <p className="font-medium">
            These Terms of Use govern access to and use of RateMyUnit. By using RateMyUnit, you agree to these terms.
            If you do not agree, do not use the platform.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">1. About The Service</h2>
          <p className="font-medium">
            RateMyUnit is a student-focused platform for discovering, rating and reviewing Australian university units.
            We may update, suspend or discontinue features at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">2. Accounts And Eligibility</h2>
          <ul className="list-disc pl-6 space-y-2 font-medium">
            <li>You must provide accurate account information and keep your credentials secure.</li>
            <li>You are responsible for activity under your account.</li>
            <li>We may require university email/domain verification for access to some features.</li>
            <li>We may suspend or terminate accounts involved in abuse, fraud or policy violations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">3. Community Rules</h2>
          <ul className="list-disc pl-6 space-y-2 font-medium">
            <li>Do not post unlawful, defamatory, harassing, threatening, hateful or misleading content.</li>
            <li>Do not impersonate others or misrepresent your identity, enrolment or experience.</li>
            <li>Do not upload malware, scrape protected endpoints, or interfere with platform security.</li>
            <li>Do not use the service for spam, scams or unauthorised commercial promotions.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">4. User Content And Licence</h2>
          <p className="font-medium">
            You retain ownership of content you submit. You grant RateMyUnit a worldwide, non-exclusive, royalty-free
            licence to host, reproduce, adapt, moderate, publish and display your content for operating and improving
            the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">5. Moderation And Enforcement</h2>
          <p className="font-medium">
            We may review, remove, restrict or flag content and take account actions where needed to enforce these
            terms, comply with law, or protect users and the integrity of RateMyUnit.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">6. Intellectual Property</h2>
          <p className="font-medium">
            RateMyUnit branding, software and original platform materials are owned by or licensed to RateMyUnit. You
            must not copy, reverse engineer or commercially exploit them except as permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">7. Disclaimers</h2>
          <ul className="list-disc pl-6 space-y-2 font-medium">
            <li>Reviews reflect user opinions and are not endorsed as complete or error-free statements of fact.</li>
            <li>Unit information may change and should be verified with your university.</li>
            <li>RateMyUnit is provided on an &quot;as is&quot; and &quot;as available&quot; basis.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">8. Liability</h2>
          <p className="font-medium">
            To the maximum extent permitted by law, RateMyUnit excludes liability for indirect, incidental or
            consequential loss arising from your use of the platform. Nothing in these terms excludes rights that cannot
            be excluded under the Australian Consumer Law or other non-excludable laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">9. Termination</h2>
          <p className="font-medium">
            You may stop using RateMyUnit at any time. We may suspend or terminate access immediately for serious or
            repeated breaches of these terms, or where required for security/legal reasons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">10. Governing Law</h2>
          <p className="font-medium">
            These terms are governed by the laws of New South Wales, Australia, and applicable Commonwealth laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">11. Contact</h2>
          <p className="font-medium">
            Email: <a className="underline font-bold" href="mailto:hello@ratemyunit.dev">hello@ratemyunit.dev</a>
          </p>
          <p className="font-medium">Owner: Ali Bonagdaran</p>
        </section>

        <div className="pt-2 font-medium">
          Read our <Link to="/privacy" className="underline font-bold">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
