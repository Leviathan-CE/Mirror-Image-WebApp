import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}))

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({}),
}))

import { StripePaymentForm } from "@/components/billing/StripePaymentForm"

describe("StripePaymentForm", () => {
  it("mounts Payment Element when client_secret is present", () => {
    render(
      <StripePaymentForm
        publishableKey="pk_test_x"
        clientSecret="pi_test_secret"
        submitLabel="SUBSCRIBE ON THIS SITE"
        onPaid={vi.fn()}
        onError={vi.fn()}
      />
    )

    expect(screen.getByTestId("stripe-elements")).toBeInTheDocument()
    expect(screen.getByTestId("payment-element")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "SUBSCRIBE ON THIS SITE" })
    ).toBeInTheDocument()
  })

  it("renders nothing without a client secret", () => {
    const { container } = render(
      <StripePaymentForm
        publishableKey="pk_test_x"
        clientSecret=""
        submitLabel="PAY"
        onPaid={vi.fn()}
        onError={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
