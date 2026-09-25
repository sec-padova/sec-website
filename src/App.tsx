import MemberDirectory from "./MemberDirectory"
import InterestForm from "./components/InterestForm"
import { supabase } from "./lib/supabase"
import { members } from "./members"

export default function App() {
  return (
    <>
    <a className="skip-link" href="#main">Skip to content</a>

    <header className="site-header">
      <a className="brand" href="#top" aria-label="Student Entrepreneurs Club, back to top">
        <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span className="brand-name">Student<br />Entrepreneurs Club</span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#about">About</a>
        <a href="#what-we-do">What we do</a>
        <a href="#community">Community</a>
        <a href="#team">People</a>
      </nav>
      <a className="header-cta" href="#join">
        Join the list <span aria-hidden="true">↘</span>
      </a>
    </header>

    <main id="main">
      <section className="hero section-wrap" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line"></span> Made by students, in Padova</p>
          <h1 id="hero-title" aria-label="Ideas move when people meet">Ideas move<br />when <em>people</em><br />meet<span className="period">.</span></h1>
          <p className="hero-lede">
            A place for University of Padova students to discover the startup world,
            meet across disciplines, and turn curiosity into projects they lead themselves.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#join">Join the interest list <span aria-hidden="true">↘</span></a>
          </div>
        </div>
        <div className="hero-art" role="img" aria-label="Different fields of study connected around a shared idea">
          <div className="art-grid" aria-hidden="true"></div>
          <div className="orbit orbit-one" aria-hidden="true"></div>
          <div className="orbit orbit-two" aria-hidden="true"></div>
          <div className="orbit orbit-three" aria-hidden="true"></div>
          <span className="art-label art-label-top">START<br />SOMEWHERE</span>
          <span className="art-node node-design">design</span>
          <span className="art-node node-engineering">engineering</span>
          <span className="art-node node-business">business</span>
          <span className="art-node node-science">science</span>
          <span className="art-node node-humanities">humanities</span>
          <span className="art-center">What if<br />we built it?</span>
          <span className="art-star art-star-one" aria-hidden="true">✳</span>
          <span className="art-star art-star-two" aria-hidden="true">✳</span>
          <span className="art-caption">DIFFERENT MINDS. SHARED MOMENTUM.</span>
        </div>
      </section>

      <div className="ticker" aria-label="Explore, connect, create">
        <div className="ticker-inner" aria-hidden="true">
          <span>EXPLORE <b>✳</b> CONNECT <b>✳</b> CREATE <b>✳</b></span>
          <span>EXPLORE <b>✳</b> CONNECT <b>✳</b> CREATE <b>✳</b></span>
        </div>
      </div>

      <section className="about section-wrap section-pad" id="about" aria-labelledby="about-title">
        <div className="section-intro">
          <p className="eyebrow">01 / Why we exist</p>
          <h2 id="about-title">The next idea could start with <em>someone you haven’t met yet.</em></h2>
        </div>
        <div className="about-body">
          <p>
            Startup stories can feel far away from university life. We’re bringing them closer:
            making room to learn from people building things, ask questions, and try ideas together.
          </p>
          <p>
            This is a student led club for the curious, the builders, and everyone in between.
            Your course of study is a starting point, not a boundary.
          </p>
          <a className="inline-arrow" href="#what-we-do">See how it works <span aria-hidden="true">↘</span></a>
        </div>
      </section>

      <section className="work section-pad" id="what-we-do" aria-labelledby="work-title">
        <div className="section-wrap">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">02 / What we do</p>
              <h2 id="work-title">From “what if?”<br />to <em>“let’s try.”</em></h2>
            </div>
            <p>Three ways to get started. No founder title required.</p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-top"><span>01</span><span aria-hidden="true">↗</span></div>
              <div className="feature-symbol" aria-hidden="true">✳</div>
              <h3>Come to events</h3>
              <p>Get closer to the startup world through events, conversations, and people willing to share what they’ve learned.</p>
            </article>
            <article className="feature-card">
              <div className="feature-top"><span>02</span><span aria-hidden="true">↗</span></div>
              <div className="feature-symbol intersect" aria-hidden="true"><i></i><i></i></div>
              <h3>Meet your people</h3>
              <p>Network with students from other departments and bring different skills and perspectives to the same table.</p>
            </article>
            <article className="feature-card">
              <div className="feature-top"><span>03</span><span aria-hidden="true">↗</span></div>
              <div className="feature-symbol arrow-symbol" aria-hidden="true">↗</div>
              <h3>Build together</h3>
              <p>Turn a shared question into a multidisciplinary project, shaped and managed by the students building it.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="community section-wrap section-pad" id="community" aria-labelledby="community-title">
        <div className="community-art" aria-hidden="true">
          <span className="community-orbit orbit-a"></span>
          <span className="community-orbit orbit-b"></span>
          <span className="community-orbit orbit-c"></span>
          <span className="community-dot dot-a"></span>
          <span className="community-dot dot-b"></span>
          <span className="community-dot dot-c"></span>
          <span className="community-dot dot-d"></span>
          <span className="community-dot dot-e"></span>
          <span className="community-word">YOU<br />BELONG<br />HERE<span>.</span></span>
        </div>
        <div className="community-copy">
          <p className="eyebrow">03 / Who it’s for</p>
          <h2 id="community-title">Bring your<br /><em>curiosity.</em></h2>
          <p>
            You might have a big idea, a half formed question, or simply an interest in meeting
            people who see possibilities everywhere. We’re built around students, and anyone
            curious about building with us is welcome.
          </p>
          <ul className="community-list">
            <li>Students from every department</li>
            <li>People beyond campus, too</li>
            <li>No startup experience required</li>
          </ul>
        </div>
      </section>

      <section className="connection section-pad" aria-labelledby="connection-title">
        <div className="section-wrap connection-inner">
          <p className="eyebrow">Built in Padova / Connected beyond campus</p>
          <h2 id="connection-title">Student energy meets <em>real world experience.</em></h2>
          <p>
            Born among University of Padova students, the club connects campus curiosity with
            professors and organizations working beyond it.
          </p>
          <div className="collaborators" aria-label="Club collaborators">
            <a href="https://www.unipd.it/en" target="_blank" rel="noopener noreferrer">
              <span>University of Padova</span><span aria-hidden="true">↗</span>
            </a>
            <a href="https://www.m31.com/" target="_blank" rel="noopener noreferrer">
              <span>M31</span><span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className="team section-wrap section-pad" id="team" aria-labelledby="team-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">04 / The people</p>
            <h2 id="team-title">A club made of<br /><em>different minds.</em></h2>
          </div>
          <p>Every person brings a new perspective. Meet the students and curious people building this community together.</p>
        </div>
        <MemberDirectory members={members} />
      </section>

      <section className="last-cta section-pad" id="join" aria-labelledby="cta-title">
        <div className="section-wrap">
          <p className="eyebrow">The conversation starts here</p>
          <h2 id="cta-title">The next idea<br />needs <em>you.</em></h2>
          <p>Curious about joining a community of students and builders in Padova? Leave your email and we may invite you when membership opens.</p>
          <div className="interest-wrap">
            <h3>Join the interest list</h3>
            <InterestForm client={supabase} />
          </div>
        </div>
      </section>
    </main>

    <footer className="site-footer">
      <div className="section-wrap footer-inner">
        <a className="brand brand-footer" href="#top" aria-label="Student Entrepreneurs Club, back to top">
          <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span className="brand-name">Student<br />Entrepreneurs Club</span>
        </a>
        <p>Curiosity is better together.<br />Padova, Italy.</p>
        <a className="social-link" href="https://github.com/sec-padova" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
      </>
  )
}
