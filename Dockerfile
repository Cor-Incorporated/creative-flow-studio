FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV GOOGLE_CLIENT_ID=test-google-client-id \
    GOOGLE_CLIENT_SECRET=test-google-client-secret \
    NEXTAUTH_SECRET=test-secret-for-build-only-32-characters-long \
    GEMINI_API_KEY=AIzaSyDrGsdwBjrkG5Hw_g-RxAcJ-OhzPwURKdk \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    NEXT_PUBLIC_SUPABASE_URL=https://kppniwizumnnlhndjnlg.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwcG5pd2l6dW1ubmxobmRqbmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTEyMTksImV4cCI6MjA3ODQ4NzIxOX0.cCK57jIkvzapDdeSQlNbvR-ukwFfFezSLp5ThMGqZwc \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51P6WQ9Li6CKW3pRaOv6T8Fn4GfIuPVXsJq0mbvTfZM4FgB1BIGha2ttGPwBq6dTSH0N217mWkRoJ8FJcR4uRkTnI00TdFBGidG
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "run", "start"]

