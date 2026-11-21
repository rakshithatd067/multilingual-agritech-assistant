import { useEffect, useMemo, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || ''
const navItems = [
  { id: 'dashboard', label: 'Overview', icon: '⌂' },
  { id: 'weather', label: 'Weather', icon: '☼' },
  { id: 'markets', label: 'Mandi prices', icon: '⌁' },
  { id: 'soil', label: 'Soil & crops', icon: '♧' },
  { id: 'assistant', label: 'AI assistant', icon: '✳' },
]
const languageOptions = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', speech: 'kn-IN' },
]

async function api(path, body) {
  const response = await fetch(`${API}/api/${path}`, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `Backend returned HTTP ${response.status} without a JSON diagnostic. Check the Flask terminal.`)
  }
  if (!data) throw new Error('The backend returned an invalid response. Check the Flask terminal.')
  return data
}

function Icon({ children, className = '' }) { return <span aria-hidden="true" className={`icon ${className}`}>{children}</span> }
function ErrorNote({ children }) { return children ? <div className="notice error" role="alert">{children}</div> : null }
function EmptyNote({ children }) { return <div className="empty-note">{children}</div> }
function PanelTitle({ eyebrow, title, detail, action }) {
  return <div className="panel-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{detail && <p className="muted">{detail}</p>}</div>{action}</div>
}

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  return <>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#dashboard" onClick={(e) => { e.preventDefault(); setPage('dashboard'); setMobileOpen(false) }}>
        <span className="brand-mark">f.</span><span>fieldwise<small>FARM ADVISORY</small></span>
      </a>
      <div className="sidebar-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileOpen(false) }}>
          <Icon>{item.icon}</Icon><span>{item.label}</span>{item.id === 'assistant' && <span className="nav-new">AI</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="season-card"><div className="season-icon">☀</div><div><strong>Grow with confidence</strong><p>Local information for better decisions.</p></div></div>
        <div className="profile-row"><div className="avatar">✿</div><div><strong>Farm companion</strong><span>Your advisory space</span></div><span className="dots">···</span></div>
      </div>
    </aside>
  </>
}

function Header({ title, setMobileOpen }) {
  return <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button><div className="breadcrumb">FIELDWISE <span>/</span> <strong>{title}</strong></div><div className="topbar-right"><span className="live-dot" /> Local advisory <span className="top-avatar">F</span></div></header>
}

function Dashboard({ setPage, summary, weather, weatherError, mandi, mandiError, refreshWeather }) {
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return <div className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">{today.toUpperCase()}</p><h1>Good morning, farmer <span>✳</span></h1><p className="muted">A clearer view of what’s happening on your farm.</p></div>
      <button className="button button-primary" onClick={() => setPage('assistant')}><Icon>✳</Icon> Ask the assistant <span>↗</span></button></div>
    <section className="hero-card"><div className="hero-copy"><div className="hero-tag"><span>✦</span> YOUR FARM, IN FOCUS</div><h2>Small decisions.<br /><em>Better harvests.</em></h2><p>Check the forecast, explore market prices, and get practical guidance for the season ahead.</p><button className="button button-light" onClick={() => setPage('soil')}>Explore crop guidance <span>→</span></button></div><div className="hero-art" aria-hidden="true"><div className="sun-disc" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="crop-stem stem-one">♧</div><div className="crop-stem stem-two">♧</div><div className="crop-stem stem-three">♧</div><div className="hero-stat"><span>FIELD NOTE</span><strong>Rooted in your local conditions</strong><small>Weather · soil · market</small></div></div><div className="hero-grain" /></section>
    <div className="section-heading"><div><p className="eyebrow">YOUR FARM SNAPSHOT</p><h2>Today at a glance</h2></div><span className="fresh-label"><span /> Live when connected</span></div>
    <div className="snapshot-grid">
      <article className="card weather-card"><div className="card-top"><span className="card-icon weather-icon">☼</span><button className="text-link" onClick={() => setPage('weather')}>Full forecast ↗</button></div><p className="eyebrow">WEATHER</p><ErrorNote>{weatherError}</ErrorNote>{weather ? <><div className="weather-main"><strong>{weather.temperature_c}°</strong><span>{weather.description}<small>{weather.location}{weather.country ? `, ${weather.country}` : ''}</small></span><span className="weather-symbol">{weather.icon ? <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt="" /> : '☀'}</span></div><div className="mini-metrics"><span><b>⌁</b> {weather.humidity_pct}% humidity</span><span><b>↘</b> {weather.rainfall_today_mm ?? '—'} mm rain</span></div></> : <div className="inline-search"><input id="quick-location" placeholder="Enter your town or district" aria-label="Town or district" onKeyDown={e => e.key === 'Enter' && refreshWeather(e.currentTarget.value)} /><button aria-label="Check weather" onClick={() => refreshWeather(document.getElementById('quick-location')?.value)}>→</button><small>Connect an OpenWeather key to see live conditions.</small></div>}</article>
      <article className="card market-card"><div className="card-top"><span className="card-icon market-icon">⌁</span><button className="text-link" onClick={() => setPage('markets')}>Explore markets ↗</button></div><p className="eyebrow">MARKET WATCH</p><ErrorNote>{mandiError}</ErrorNote>{mandi?.records?.length ? <><div className="market-feature"><strong>{mandi.records[0].commodity}</strong><span>{mandi.records[0].market}</span></div><div className="price-line"><span>Modal price <small>₹ / quintal</small></span><strong>₹{Number(mandi.records[0].modal_price).toLocaleString('en-IN')}</strong></div><p className="source-line">Source: {mandi.source} · {mandi.records[0].arrival_date || 'Date not supplied'}</p></> : <div className="market-empty"><div className="crop-doodle">⌂</div><strong>Prices that matter to you</strong><span>Search current mandi rates by crop.</span><button className="button button-outline" onClick={() => setPage('markets')}>Find a market price <span>→</span></button></div>}</article>
      <article className="card tip-card"><div className="tip-spark">✳</div><p className="eyebrow">A THOUGHT FOR TODAY</p><h3>Good farming starts with good information.</h3><p className="muted">Use your soil results and local forecast together before planning the next field task.</p><button className="text-link" onClick={() => setPage('soil')}>Explore soil guidance <span>→</span></button></article>
    </div>
    <div className="lower-grid"><section className="card action-card"><PanelTitle eyebrow="GET STARTED" title="What would you like to do?"/><div className="action-list"><button onClick={() => setPage('weather')}><span className="action-emoji">☼</span><span><strong>Plan around the weather</strong><small>See a five-day local forecast</small></span><b>→</b></button><button onClick={() => setPage('markets')}><span className="action-emoji">⌁</span><span><strong>Check mandi prices</strong><small>Look up market rates for your crop</small></span><b>→</b></button><button onClick={() => setPage('soil')}><span className="action-emoji">♧</span><span><strong>Find crops for your soil</strong><small>Use your soil values for suggestions</small></span><b>→</b></button></div></section>
      <section className="card note-card"><div className="note-heading"><div className="note-icon">i</div><strong>Use advice as a starting point</strong></div><p>Forecasts and AI guidance can help with planning, but local conditions vary. Confirm important crop protection and nutrient decisions with a local agriculture expert.</p><div className="status-row"><span className="status-pill">{summary?.services?.weather ? 'Weather connected' : 'Weather setup needed'}</span><span className="status-pill">{summary?.services?.mandi ? 'Markets connected' : 'Markets setup needed'}</span></div></section></div>
    <p className="page-footnote">Fieldwise gives general guidance, not guaranteed yield or profit predictions.</p>
  </div>
}

function WeatherPage({ initialLocation, weather, setWeather, weatherError, setWeatherError }) {
  const [location, setLocation] = useState(initialLocation || '')
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (initialLocation) setLocation(initialLocation) }, [initialLocation])
  async function submit(e) { e.preventDefault(); setLoading(true); setWeatherError(''); try { setWeather(await api('weather', { location })) } catch (error) { setWeather(null); setWeatherError(error.message) } finally { setLoading(false) } }
  return <div className="page-content"><PanelTitle eyebrow="FIELD CONDITIONS" title="Weather outlook" detail="Use the local forecast to plan field work and irrigation." />
    <form className="search-bar card" onSubmit={submit}><div className="search-mark">⌖</div><label><span>Town, city or district</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mysuru, Karnataka" required /></label><button className="button button-primary" disabled={loading}>{loading ? 'Checking…' : 'Get forecast'} <span>→</span></button></form>
    <ErrorNote>{weatherError}</ErrorNote>
      {weather ? <><div className="weather-detail-grid"><section className="card current-weather"><div className="current-top"><div><p className="eyebrow">CURRENT CONDITIONS · {weather.location.toUpperCase()}</p><h2>{weather.description}</h2><p className="muted">Updated from {weather.source}</p></div><div className="big-weather">{weather.icon ? <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt="" /> : '☼'}<strong>{weather.temperature_c}°</strong></div></div><div className="weather-measures"><div><span>Feels like</span><strong>{weather.feels_like_c}°C</strong></div><div><span>Humidity</span><strong>{weather.humidity_pct}%</strong></div><div><span>Rain today*</span><strong>{weather.rainfall_today_mm ?? '—'} mm</strong></div></div><p className="fine-print">*Rainfall is summed from available forecast intervals for today; it is not a rain-gauge observation.</p></section>
      <section className="card advice-card"><span className="advice-leaf">♧</span><p className="eyebrow">WEATHER-BASED FIELD NOTE</p><h3>Plan with the conditions in mind</h3>{weather.advice.map((line, i) => <p key={i} className="advice-line"><span>✓</span>{line}</p>)}<p className="fine-print">General planning advice. Check actual field conditions before acting.</p></section></div>
      <section className="card forecast-section"><PanelTitle eyebrow="UP TO FIVE DAYS" title="Forecast" detail="Forecast values are supplied by OpenWeather and can change."/><div className="forecast-grid">{weather.forecast.map(day => <article className="forecast-day" key={day.date}><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</span><time>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${day.date}T12:00:00`))}</time>{day.icon ? <img src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} alt={day.description} /> : <b>☁</b>}<small>{day.description}</small><strong>{day.max}° <i>{day.min}°</i></strong><em>↘ {day.rainfall_mm} mm</em></article>)}</div><p className="source-line">Source: {weather.source}. Forecast retrieved {new Date(weather.updated_at).toLocaleString()}.</p></section></> : !weatherError && <EmptyNote>Enter a location to load an actual forecast. Weather is never filled with sample values.</EmptyNote>}
  </div>
}

function MarketsPage({ result, setResult }) {
  const [crop, setCrop] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e) { e.preventDefault(); setLoading(true); setError(''); setResult(null); try { setResult(await api('mandi', { crop, state })) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  return <div className="page-content"><PanelTitle eyebrow="MARKET INFORMATION" title="Mandi prices" detail="Search verified market records for a crop. Rates may vary by market and arrival date." />
    <form className="search-bar card market-search" onSubmit={submit}><div className="search-mark">⌕</div><label><span>Crop name</span><input value={crop} onChange={e => setCrop(e.target.value)} placeholder="e.g. Tomato, Maize, Onion" required /></label><label><span>State <small>(optional)</small></span><input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Karnataka" /></label><button className="button button-primary" disabled={loading}>{loading ? 'Searching…' : 'Search prices'} <span>→</span></button></form>
    <ErrorNote>{error}</ErrorNote>
    {result ? <section className="card table-card"><PanelTitle eyebrow="LATEST AVAILABLE RECORDS" title={`${crop || result.records[0]?.commodity || 'Crop'} market rates`} detail={`${result.records.length} record${result.records.length === 1 ? '' : 's'} · Source: ${result.source}`} /><div className="table-wrap"><table><thead><tr><th>Market / district</th><th>Variety</th><th>Min. price</th><th>Modal price</th><th>Max. price</th><th>Data date</th></tr></thead><tbody>{result.records.map((row, i) => <tr key={`${row.market}-${row.arrival_date}-${i}`}><td><strong>{row.market}</strong><small>{[row.district, row.state].filter(Boolean).join(', ')}</small></td><td>{row.variety || '—'}{row.grade ? <small>{row.grade}</small> : null}</td><td>₹{Number(row.min_price).toLocaleString('en-IN')}</td><td className="modal-price">₹{Number(row.modal_price).toLocaleString('en-IN')}</td><td>₹{Number(row.max_price).toLocaleString('en-IN')}</td><td>{row.arrival_date || 'Not supplied'}</td></tr>)}</tbody></table></div><p className="source-line">Source: {result.source}. Retrieved {new Date(result.retrieved_at).toLocaleString()}. Prices are supplied by the source and shown without estimates.</p></section> : !error && <section className="market-intro card"><div className="market-intro-art">⌂<span>₹</span></div><div><p className="eyebrow">CLEAR PRICES, BETTER PLANS</p><h3>Know what’s happening at market.</h3><p>Search by crop to see reported market, minimum, maximum and modal prices with the data date and source.</p></div></section>}
  </div>
}

function SoilPage() {
  const [form, setForm] = useState({ soil_type: '', ph: '', nitrogen: '', phosphorus: '', potassium: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  async function submit(e) { e.preventDefault(); setLoading(true); setError(''); setResult(null); try { setResult(await api('recommend', form)); setHistory(prev => [new Date().toLocaleString(), ...prev].slice(0, 3)) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  return <div className="page-content"><PanelTitle eyebrow="SOIL & CROP PLANNING" title="Start with your soil" detail="Add the values you have from a soil test. Leave unknown nutrients blank." />
    <div className="soil-layout"><form className="card soil-form" onSubmit={submit}><div className="form-section-title"><span>01</span><div><strong>Tell us about your soil</strong><small>These inputs guide broad crop suggestions.</small></div></div><label className="field-label">Soil type <select value={form.soil_type} onChange={e => change('soil_type', e.target.value)}><option value="">Select if known</option><option>Clay</option><option>Loam</option><option>Sandy</option><option>Black</option><option>Red</option><option>Alluvial</option><option>Other / not sure</option></select></label><label className="field-label">Soil pH <input type="number" min="0" max="14" step="0.1" value={form.ph} onChange={e => change('ph', e.target.value)} placeholder="e.g. 6.5" /><small>Typical scale: 0–14</small></label><div className="nutrient-heading"><span>02</span><div><strong>Soil nutrients <small>(optional)</small></strong><p>Enter values from your soil report.</p></div></div><div className="nutrient-grid">{[['nitrogen', 'Nitrogen (N)'], ['phosphorus', 'Phosphorus (P)'], ['potassium', 'Potassium (K)']].map(([key, label]) => <label className="field-label" key={key}>{label}<input type="number" min="0" step="any" value={form[key]} onChange={e => change(key, e.target.value)} placeholder="mg/kg if reported" /></label>)}</div><button className="button button-primary full-button" disabled={loading}>{loading ? 'Finding suggestions…' : 'Suggest suitable crops'} <span>→</span></button><p className="fine-print">For guidance only. Soil lab units and local conditions matter.</p></form>
      <div className="recommendations-column">{error && <ErrorNote>{error}</ErrorNote>}{result ? <><div className="recommend-heading"><p className="eyebrow">YOUR SOIL SNAPSHOT</p><h2>Crop suggestions</h2><p className="muted">Suggestions use general soil profiles, not a yield prediction.</p></div><div className="crop-results">{result.recommendations.map((crop, index) => <article className="card crop-result" key={crop.crop}><div className="crop-result-top"><div className="crop-avatar">{['◉', '♧', '✿', '❋'][index]}</div><div><h3>{crop.crop}</h3><span className={`match-label ${crop.match === 'Better match' ? 'match-good' : ''}`}>{crop.match}</span></div><span className="crop-number">0{index + 1}</span></div><p>{crop.reasons.join(' · ')}</p><details><summary>Planting, harvest & protection guidance</summary><div><p><strong>Planting</strong>{crop.planting}</p><p><strong>Estimated harvest period</strong>{crop.harvest}</p><p><strong>Crop protection</strong>{crop.protection}</p></div></details></article>)}</div><div className="notice disclaimer">ⓘ {result.disclaimer}</div></> : <div className="soil-placeholder card"><div className="soil-art"><span>♧</span><i>·</i><b>✳</b></div><p className="eyebrow">THOUGHTFUL, PRACTICAL GUIDANCE</p><h3>Your soil has a story.</h3><p className="muted">Share the details you know and explore crops that may fit. A local soil test gives the best foundation.</p>{history.length > 0 && <small>Last recommendation saved · {history[0]}</small>}</div>}</div></div>
  </div>
}

function AssistantPage() {
  const [language, setLanguage] = useState('en')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const endRef = useRef(null)
  const lang = useMemo(() => languageOptions.find(item => item.code === language), [language])
  useEffect(() => { api('history').then(data => setMessages(data.messages.map(({ role, content, language: code, created_at }) => ({ role, text: content, language: code, time: created_at })))).catch(() => {}) }, [])
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading])
  async function send(text = draft) {
    const message = text.trim()
    if (!message || loading) return
    setDraft(''); setError(''); setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: message, language }])
    try { const data = await api('chat', { message, language }); setMessages(prev => [...prev, { role: 'assistant', text: data.answer, language, time: new Date().toISOString() }]) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  function speak(text, code) {
    if (!window.speechSynthesis) { setError('Speech playback is not available in this browser.'); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = languageOptions.find(item => item.code === code)?.speech || 'en-IN'
    window.speechSynthesis.speak(utterance)
  }
  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setError('Voice input is not available in this browser. You can type your question instead.'); return }
    const recognition = new Recognition(); recognition.lang = lang.speech; recognition.interimResults = false; recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false)
    recognition.onerror = () => { setListening(false); setError('Could not hear that clearly. Please try again or type your question.') }
    recognition.onresult = event => setDraft(event.results[0][0].transcript)
    recognition.start()
  }
  return <div className="page-content assistant-page"><div className="assistant-heading"><div><p className="eyebrow">YOUR FARMING COMPANION</p><h1>Ask the assistant <span className="assistant-star">✳</span></h1><p className="muted">Practical answers for the questions that grow with you.</p></div><label className="language-select"><span>REPLY IN</span><select value={language} onChange={e => setLanguage(e.target.value)}>{languageOptions.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label></div>
    <div className="assistant-shell card"><div className="chat-top"><div className="bot-avatar">✳</div><div><strong>Fieldwise assistant</strong><span><i /> Ready to help · {lang.label}</span></div><span className="chat-top-badge">GENERAL FARM GUIDANCE</span></div>
      <div className="chat-body">{messages.length === 0 && <div className="chat-welcome"><div className="welcome-orbit">✳</div><h2>What’s on your mind?</h2><p>Ask in {lang.label} about planting, soil care, common crop concerns, or how to understand a forecast.</p><div className="prompt-chips">{['How can I prepare my soil for planting?', 'What should I consider before irrigating?', 'How do I protect crops from common pests?'].map((question, i) => <button key={i} onClick={() => send(question)}>{question}<span>↗</span></button>)}</div><div className="ai-note">✦ AI replies are general guidance. Verify local conditions and important decisions with an agriculture expert.</div></div>}
        {messages.map((message, i) => <div className={`message-row ${message.role === 'user' ? 'message-user' : ''}`} key={`${i}-${message.time || ''}`}><div className={`message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'F' : '✳'}</div><div className="message-content"><span className="message-byline">{message.role === 'user' ? 'YOU' : 'FIELDWISE ASSISTANT'} · {message.language || language}</span><div className="message-bubble">{message.text}</div>{message.role === 'assistant' && <button className="speak-button" onClick={() => speak(message.text, message.language || language)}>◖ Speak response</button>}</div></div>)}
        {loading && <div className="message-row"><div className="message-avatar">✳</div><div className="typing-indicator"><span /><span /><span /> Thinking through your question…</div></div>}<div ref={endRef} /></div>
      <ErrorNote>{error}</ErrorNote><form className="chat-composer" onSubmit={e => { e.preventDefault(); send() }}><button type="button" className={`voice-button ${listening ? 'listening' : ''}`} aria-label="Speak question" title="Speak question" onClick={startListening}>{listening ? '◉' : '♩'}</button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask a farming question…'} aria-label="Your question" /><button type="submit" className="send-button" disabled={loading || !draft.trim()} aria-label="Send message">↑</button></form><div className="composer-foot">Voice input availability depends on your browser. <span>General guidance · Not a substitute for local expert advice</span></div>
    </div></div>
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [summary, setSummary] = useState(null)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [mandi, setMandi] = useState(null)
  const [mandiError, setMandiError] = useState('')
  useEffect(() => { api('dashboard').then(data => { setSummary(data); if (data.location) api('weather', { location: data.location }).then(setWeather).catch(err => setWeatherError(err.message)) }).catch(() => {}) }, [])
  const title = navItems.find(item => item.id === page)?.label || 'Overview'
  async function refreshWeather(location) { if (!location?.trim()) return; setWeatherError(''); try { setWeather(await api('weather', { location: location.trim() })) } catch (err) { setWeather(null); setWeatherError(err.message) } }
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><main className="main-area"><Header title={title} setMobileOpen={setMobileOpen} />{page === 'dashboard' && <Dashboard setPage={setPage} summary={summary} weather={weather} weatherError={weatherError} mandi={mandi} mandiError={mandiError} refreshWeather={refreshWeather} />}{page === 'weather' && <WeatherPage initialLocation={summary?.location} weather={weather} setWeather={setWeather} weatherError={weatherError} setWeatherError={setWeatherError} />}{page === 'markets' && <MarketsPage result={mandi} setResult={setMandi} />}{page === 'soil' && <SoilPage />}{page === 'assistant' && <AssistantPage />}<footer className="app-footer"><span>FIELDWISE <i>·</i> PRACTICAL GUIDANCE FOR GROWING</span><span>Made for the people who grow our food <b>✳</b></span></footer></main></div>
}
