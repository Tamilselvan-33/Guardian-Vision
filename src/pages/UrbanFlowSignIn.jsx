import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import "../styles/urbanflow.css"
import { apiFetch } from "../lib/api"
import { motion } from "framer-motion"

// Layout adapted from traffic-detection.html, scoped under .urbanflow-root

const UrbanFlowSignIn = () => {
  const navigate = useNavigate()
  const heroRef = useRef(null)
  const [mode, setMode] = useState("login") // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [form, setForm] = useState({ name: "", email: "", phone: "" })

  const handleHeroMouseMove = (event) => {
    if (!heroRef.current) return
    const rect = heroRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const clampedX = Math.max(0, Math.min(1, x || 0.5))
    const angle = 100 + clampedX * 80 // 100deg – 180deg
    heroRef.current.style.setProperty("--hero-grad-angle", `${angle}deg`)
  }

  return (
    <div className="urbanflow-root min-h-screen text-white">
      <header>
        <nav>
          <div className="brand">UrbanFlow AI</div>
          <div className="nav-links">
            <a href="#studio">Ops Studio</a>
            <a href="#impact">Impact</a>
          </div>
          <button className="cta-btn">
            Reviewed Data Vault
          </button>
        </nav>
      </header>

      <main>
        <section
          ref={heroRef}
          className="hero"
          onMouseMove={handleHeroMouseMove}
        >
          <span className="orb" />
          <span className="orb" />

          <div>
            <p className="badge">Traffic Ops Access</p>
            <h1>UrbanFlow Command Sign-in</h1>
            <p>
              Secure access for traffic operations teams to review live detections, replay
              incidents, and coordinate faster responses citywide.
            </p>

            {/* Glass console with jelly login / sign-up */}
            <motion.div 
              className="signin-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.01, rotateY: 2, rotateX: -2 }}
            >
              <div className="signin-toggle">
                <button
                  type="button"
                  className={`toggle-pill ${mode === "login" ? "active" : ""}`}
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`toggle-pill ${mode === "signup" ? "active" : ""}`}
                  onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                >
                  Sign Up
                </button>
              </div>

              {error && <p className="text-[10px] text-red-500 mb-4 font-bold">{error}</p>}
              {success && <p className="text-[10px] text-emerald-500 mb-4 font-bold">{success}</p>}

              {mode === "login" ? (
                <>
                  <h2>Ops Login</h2>
                  <p className="signin-subtitle">
                    Quick access for on-duty controllers. Use your name and work email to step
                    into the UrbanFlow console.
                  </p>
                  <form
                    className="signin-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setLoading(true)
                      setError("")
                      try {
                        await apiFetch("/api/auth/login", {
                          method: "POST",
                          body: JSON.stringify({ name: form.name, email: form.email })
                        });
                        navigate("/dashboard")
                      } catch (err) {
                        setError(err.message || "Login failed")
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    <label className="signin-field">
                      <span>Name</span>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="Traffic controller name"
                      />
                    </label>
                    <label className="signin-field">
                      <span>Email</span>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        placeholder="you@city.gov"
                      />
                    </label>
                    <button type="submit" disabled={loading} className="cta-btn signin-submit">
                      {loading ? "Verifying..." : "Continue to UrbanFlow"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h2>Request UrbanFlow Access</h2>
                  <p className="signin-subtitle">
                    New to the console? Share your details so your team lead can approve access to
                    the UrbanFlow traffic vault.
                  </p>
                  <form
                    className="signin-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setLoading(true)
                      setError("")
                      try {
                        const res = await apiFetch("/api/auth/signup", {
                          method: "POST",
                          body: JSON.stringify(form)
                        });
                        setSuccess(res.message || "Request submitted!")
                      } catch (err) {
                        setError(err.message || "Signup failed")
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    <label className="signin-field">
                      <span>Name</span>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="Full name"
                      />
                    </label>
                    <label className="signin-field">
                      <span>Email</span>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        placeholder="you@city.gov"
                      />
                    </label>
                    <label className="signin-field">
                      <span>Phone</span>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={e => setForm({...form, phone: e.target.value})}
                        placeholder="+91 •••• ••• •••"
                      />
                    </label>
                    <button type="submit" disabled={loading} className="cta-btn signin-submit">
                      {loading ? "Submitting..." : "Continue to UrbanFlow"}
                    </button>
                  </form>
                </>
              )}

            </motion.div>
          </div>

          <div className="screen">
            <p className="screen-label">Live Signal</p>
            <div className="card">
              <strong>Incident Classifier</strong>
              <p>Wrong-way motorcycle flagged on Nguyen Trai • 12s ago</p>
            </div>
            <div className="card">
              <strong>Edge Radar Mesh</strong>
              <p>Lane capacity 78% • adaptive lights recalibrated</p>
            </div>
            <div className="card">
              <strong>Community Probe</strong>
              <p>19 citizen reports awaiting triage</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default UrbanFlowSignIn

