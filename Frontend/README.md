# Frontend Container

React + Vite + TypeScript frontend scaffold with Tailwind CSS v4 and `shadcn/ui`.

## Stack

- React 19
- Vite 8
- TypeScript 6
- Tailwind CSS v4 (`@tailwindcss/vite`)
- `shadcn/ui`

## Getting Started

```bash
npm install
npm run dev
```

## Docker

Build and run the frontend container:

```bash
docker build -t mirror-image-frontend .
docker run --rm -p 3000:80 mirror-image-frontend
```

Then open `http://localhost:3000`.

## Project Structure

```text
src/
  app/           # app shell and providers
  components/    # shared reusable components
    common/      # domain-neutral app components
    ui/          # shadcn-generated primitives
  features/      # feature-first modules
  hooks/         # reusable hooks
  lib/           # utilities and cross-cutting helpers
  pages/         # route-level pages
  services/      # API/service layer
  store/         # state containers
  styles/        # additional styling artifacts
  types/         # shared types/interfaces
```

## Using shadcn/ui

Add new components with:

```bash
npx shadcn@latest add button
```
