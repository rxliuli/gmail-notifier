import { AccessTokenResponse } from '@gmail-notifier/server'

export async function generateAccessToken(token: string) {
  const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/gcp/access-token`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!resp.ok) {
    throw resp
  }
  return (await resp.json()) as AccessTokenResponse
}

export function encodeRFC2047(str: string) {
  const base64 = btoa(unescape(encodeURIComponent(str)))
  return `=?utf-8?B?${base64}?=`
}

function encodeNameAndEmail(address: string) {
  address = address.trim()
  const i = address.indexOf('<')
  if (i === -1) {
    return address
  }
  const name = address.slice(0, i)
  const email = address.slice(i + 1, -1)
  return `${encodeRFC2047(name.trim())} <${email.trim()}>`
}

interface Message {
  id: string
  threadId: string
  payload: {
    headers: {
      name: string
      value: string
    }[]
  }
}

export async function getMessage(options: { accessToken: string; messageId: string }) {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${options.messageId}?format=metadata`,
    {
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
      },
    },
  )
  if (!resp.ok) {
    throw resp
  }
  return (await resp.json()) as Message
}

export async function replyEmail(options: {
  accessToken: string
  messageId: string
  subject: string
  content: string
  to: string
  from: string
  inReplyTo: string
  references: string
  threadId: string
}) {
  console.log('replyEmail', options)
  const email = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: Re: ${options.subject}`,
    `In-Reply-To: ${options.inReplyTo}`,
    `References: ${options.references}`,
    '',
    options.content,
  ].join('\r\n')
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedEmail,
      threadId: options.threadId,
    }),
  })
}
