import { expect, it } from 'vitest'
import { parse } from 'parse5'
import { getAttribute, getInnerHTML, getTextContent, querySelector, querySelectorAll } from './domutils'

it('querySelector', () => {
  const doc = parse('<p>Hello <strong>World</strong></p>')
  expect(querySelector('p', doc)).not.null
  expect(querySelector('strong', doc)).not.null
})

it('querySelectorAll', () => {
  const doc = parse('<p>Hello <strong>World</strong></p><br/><p>Content</p>')
  expect(querySelectorAll('p', doc)).length(2)
  expect(querySelectorAll('strong', doc)).length(1)
})

it('getAttribute', () => {
  const doc = parse('<p class="md">Hello World</p>')
  expect(getAttribute(querySelector('.md', doc), 'class')).eq('md')
})

it('getTextContent', () => {
  const doc = parse('<p>Hello <strong>World</strong></p>')
  expect(getTextContent(doc)).eq('Hello World')
})

it('getInnerHTML', () => {
  const doc = parse('<p>Hello <strong>World</strong></p>')
  expect(getInnerHTML(querySelector('p', doc))).eq('Hello <strong>World</strong>')
  expect(getInnerHTML(doc)).eq('<html><head></head><body><p>Hello <strong>World</strong></p></body></html>')
})
