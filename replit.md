# ExamBrowser - Online Examination System

## Overview

ExamBrowser is a web-based online examination platform designed for academic testing. It provides a complete exam workflow including student authentication via NIM (student ID), biodata collection, timed exam sessions with multiple-choice questions, automatic scoring, and an admin dashboard for managing questions and viewing results.

The application follows a monorepo structure with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: 
  - Zustand for global auth state with persistence
  - TanStack Query (React Query) for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod schemas for type-safe request/response validation
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Location**: `shared/schema.ts` contains all database table definitions

### Data Model
Three core entities:
1. **Students**: User accounts with NIM, name, class, and optional admin privileges
2. **Questions**: Multiple-choice questions with options array and correct answer index
3. **Submissions**: Exam sessions tracking student answers, scores, and completion status

### Authentication Flow
- Students log in with NIM (no password required for regular users)
- Admins authenticate with NIM + password
- Session state persisted in browser localStorage via Zustand
- Protected routes redirect unauthenticated users

### Key Design Decisions
- **Shared Types**: `shared/` directory contains schema and route definitions used by both frontend and backend, ensuring type safety across the stack
- **API Contract**: Routes defined with Zod schemas in `shared/routes.ts` serve as the API contract
- **Component Library**: shadcn/ui provides accessible, customizable components without external UI framework dependency
- **Path Aliases**: TypeScript path aliases (`@/`, `@shared/`) for clean imports

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations stored in `/migrations` directory
- **connect-pg-simple**: PostgreSQL session store (available but sessions currently use client-side storage)

### Frontend Libraries
- **@radix-ui/***: Headless UI primitives for accessible components
- **@tanstack/react-query**: Server state management and caching
- **framer-motion**: Animation library
- **react-hook-form** + **@hookform/resolvers**: Form handling with Zod validation
- **date-fns**: Date manipulation
- **embla-carousel-react**: Carousel functionality

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
- **@replit/vite-plugin-***: Replit-specific development plugins

### Validation
- **Zod**: Schema validation used throughout for API contracts and form validation
- **drizzle-zod**: Auto-generates Zod schemas from Drizzle table definitions