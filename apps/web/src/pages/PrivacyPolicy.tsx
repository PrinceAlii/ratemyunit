import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = '22 February 2026';

export function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="border-4 border-black bg-card shadow-neo p-6 md:p-8 space-y-6">
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-black uppercase">Privacy Policy</h1>
          <p className="font-medium">Effective date: {EFFECTIVE_DATE}</p>
          <p className="font-medium">
            This Privacy Policy explains how RateMyUnit collects, uses, stores and discloses personal information.
            RateMyUnit is operated by Ali Bonagdaran.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">1. What We Collect</h2>
          <ul className="list-disc pl-6 space-y-2 font-medium">
            <li>Account data: email address, password hash, display name, role and university association.</li>
            <li>Verification data: email/domain verification status and related token records.</li>
            <li>Review and community data: ratings, review text, votes, flags and moderation outcomes.</li>
            <li>Security and telemetry data: IP address, user-agent, browser, OS, device type and login timestamps.</li>
            <li>Session and cookie data: session identifiers used to keep you logged in and protect your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">2. How We Collect It</h2>
          <p className="font-medium">
            We collect information directly from you when you register, log in, submit reviews, vote, flag content or
            contact us. We also collect technical information automatically when you use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">3. Why We Use It</h2>
          <ul className="list-disc pl-6 space-y-2 font-medium">
            <li>To provide and maintain RateMyUnit.</li>
            <li>To verify student access and reduce misuse.</li>
            <li>To moderate reviews and keep the platform safe and useful.</li>
            <li>To secure accounts, detect abuse and improve performance.</li>
            <li>To send service messages, account verification and password reset emails.</li>
            <li>To comply with legal obligations and enforce our Terms of Use.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">4. Cookies And Sessions</h2>
          <p className="font-medium">
            RateMyUnit uses cookies and similar technologies for authentication, session management, CSRF protection and
            core platform functionality. You can control cookies in your browser settings, but disabling them may break
            key features.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">5. Disclosure To Others</h2>
          <p className="font-medium">
            We may disclose information to trusted service providers who help operate RateMyUnit (for example, hosting,
            infrastructure, email delivery and security tools), where required by law, or to protect rights, safety and
            platform integrity. We do not sell personal information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">6. Overseas Disclosure</h2>
          <p className="font-medium">
            Service providers may process data in Australia and other countries where they operate. We take reasonable
            steps to ensure personal information is handled appropriately when disclosed overseas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">7. Storage, Security And Retention</h2>
          <p className="font-medium">
            We use technical and organisational safeguards designed to protect personal information from misuse,
            interference, loss and unauthorised access, modification or disclosure. We retain information only as long
            as reasonably needed for platform operation, legal obligations and dispute handling.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">8. Access, Correction And Deletion</h2>
          <p className="font-medium">
            You can request access to personal information we hold about you, ask us to correct inaccurate information,
            or request account/data deletion, subject to legal and operational limits.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">9. Complaints</h2>
          <p className="font-medium">
            If you have a privacy complaint, contact us first and we will investigate. If you are not satisfied with
            our response, you may be able to complain to the Office of the Australian Information Commissioner (OAIC).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-display font-black uppercase">10. Contact Us</h2>
          <p className="font-medium">
            Email: <a className="underline font-bold" href="mailto:hello@ratemyunit.dev">hello@ratemyunit.dev</a>
          </p>
          <p className="font-medium">Owner: Ali Bonagdaran</p>
        </section>

        <div className="pt-2 font-medium">
          Read our <Link to="/terms" className="underline font-bold">Terms of Use</Link>.
        </div>
      </div>
    </div>
  );
}
