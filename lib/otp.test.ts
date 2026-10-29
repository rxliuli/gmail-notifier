import { describe, expect, it } from 'vitest'
import { extractCode } from './otp'

describe('extractCode', () => {
  it.each([
    ['Your verification code is 482913', '482913'],
    ['123456 is your Instagram code', '123456'],
    ['G-847201 is your Google verification code.', '847201'],
    ['Your Amazon OTP: 3829', '3829'],
    ['Use code 384-920 to sign in', '384920'],
    ['Enter 123 456 to verify your email', '123456'],
    ['Your login code: K7X9QP', 'K7X9QP'],
    ['Your code is 0042', '0042'],
    ['Code:738291', '738291'],
    ['Ihr Bestätigungscode lautet: 552019', '552019'],
    ['Tu código de verificación es 102938', '102938'],
    ['您的验证码是 739201，请勿泄露', '739201'],
  ])('finds the code in %j', (text, code) => {
    expect(extractCode(text)).toBe(code)
  })

  it.each([
    ['Your order #12345678 has shipped'],
    ['Meeting moved to 2025-06-03 at 10:30'],
    ['Use code SAVE20 at checkout for 20% off'],
    ['Your PIN was changed on 03/06/2025'],
    ['Verify your email: https://example.com/verify?token=abc123def456'],
    ['Thanks for your payment of $1234.56'],
  ])('finds nothing in %j', (text) => {
    expect(extractCode(text)).toBeNull()
  })

  it('skips numbers that only look like codes next to the real one', () => {
    expect(
      extractCode('Your security code expires in 10 minutes. © 2025 Acme Inc. Code: 918273'),
    ).toBe('918273')
    expect(extractCode('Your verification code is 482913. Questions? Call +1 800 555 0199')).toBe('482913')
    expect(extractCode('Your payment of €1234 needs confirmation code 5521')).toBe('5521')
  })

  it('looks across subject, snippet and body', () => {
    expect(extractCode('Sign in to Acme', undefined, 'Hi,\n\nEnter this code to continue:\n\n  604218\n')).toBe(
      '604218',
    )
  })
})
