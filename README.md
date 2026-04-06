# GlobeLens

**Real-time world intelligence on a spinning 3D globe.**

GlobeLens is an open-source interactive 3D globe that surfaces real-time world news, live weather, public webcams, and traffic data — all rendered on a beautiful CesiumJS Earth.

![GlobeLens Screenshot](docs/screenshot.png)
<!-- Replace with an actual screenshot once the app is running -->

---

## Features

- **3D Interactive Globe** — Spin, zoom, and click anywhere on Earth using CesiumJS with realistic lighting and atmosphere
- **World News** — Real-time geolocated headlines from GDELT (free) and World News API, pinned to their origin on the globe
- **Live Weather** — Current conditions for any location via Open-Meteo (free, no key required)
- **Public Webcams** — Browse live webcam feeds from around the world via Windy Webcams
- **Traffic Data** — View traffic incidents and congestion from TomTom Traffic
- **Layer Toggles** — Enable/disable each data layer independently
- **Click-to-Explore** — Click any point on the globe to fetch contextual data for that location
- **Responsive UI** — Works on desktop and tablet with a sleek dark-themed glassmorphism interface

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router, TypeScript) |
| 3D Globe | [CesiumJS](https://cesium.com/) + [Resium](https://resium.reearth.io/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Database / Cache | [Supabase](https://supabase.com/) |
| News (free) | [GDELT Project](https://www.gdeltproject.org/) |
| News (key) | [World News API](https://worldnewsapi.com/) |
| Weather (free) | [Open-Meteo](https://open-meteo.com/) |
| Webcams | [Windy Webcams API](https://api.windy.com/) |
| Traffic | [TomTom Traffic API](https://developer.tomtom.com/) |
| AI Geotagging | [Anthropic Claude API](https://console.anthropic.com/) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** 9+
- API keys (see below)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/globelens.git
cd globelens

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys (see below)

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the globe.

### Environment Variables

| Variable | Required | Source |
|---|---|---|
| `WORLD_NEWS_API_KEY` | Optional | [worldnewsapi.com](https://worldnewsapi.com/) |
| `ANTHROPIC_API_KEY` | Optional | [console.anthropic.com](https://console.anthropic.com/) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | [supabase.com](https://supabase.com/) |
| `SUPABASE_SERVICE_KEY` | Optional | [supabase.com](https://supabase.com/) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional | [mapbox.com](https://account.mapbox.com/) |
| `WINDY_WEBCAMS_API_KEY` | Optional | [api.windy.com](https://api.windy.com/) |
| `TOMTOM_API_KEY` | Optional | [developer.tomtom.com](https://developer.tomtom.com/) |

> **Note:** GDELT and Open-Meteo are completely free and require no API keys. The globe renders with default Cesium imagery even without a Mapbox token.

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
npx vercel
```

Or connect the GitHub repo to [Vercel](https://vercel.com/) for automatic deployments on push.

## Project Structure

```
src/
├── app/                  # Next.js App Router pages & layout
├── components/
│   ├── Globe/            # CesiumJS 3D globe viewer
│   ├── Layers/           # News, Weather, Webcam, Traffic panels
│   └── UI/               # Shared UI (layer toggles, info panel, loading)
├── lib/
│   ├── gdelt.ts          # GDELT API client (free, no key)
│   ├── news.ts           # World News API client
│   ├── weather.ts        # Open-Meteo client (free, no key)
│   ├── webcams.ts        # Windy Webcams API client
│   ├── traffic.ts        # TomTom Traffic API client
│   └── geocode.ts        # Coordinate helpers
└── types/                # TypeScript interfaces
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
