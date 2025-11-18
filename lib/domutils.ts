import selectAll, { Options, selectOne } from 'css-select'
import { DefaultTreeAdapterMap, serialize, serializeOuter } from 'parse5'

type Element = DefaultTreeAdapterMap['element']
type Node = DefaultTreeAdapterMap['node']
type TextNode = DefaultTreeAdapterMap['textNode']
type Document = DefaultTreeAdapterMap['document']

export function xmldomAdapter(): Options<DefaultTreeAdapterMap['document'] | Element, Element>['adapter'] {
  const EMPTY_OBJECT = {}

  function isTag(elem: Node): elem is Element {
    return true
  }
  function getChildren(elem: Element): Element[] {
    return elem.childNodes ? Array.prototype.slice.call(elem.childNodes, 0) : []
  }
  function getParent(elem: Element): Element | null {
    return elem.parentNode as Element | null
  }
  function removeSubsets(nodes: (Element | null)[]): (Element | null)[] {
    var idx = nodes.length,
      node,
      ancestor,
      replace

    // Check if each node (or one of its ancestors) is already contained in the
    // array.
    while (--idx > -1) {
      node = ancestor = nodes[idx]

      // Temporarily remove the node under consideration
      nodes[idx] = null
      replace = true

      while (ancestor) {
        if (nodes.indexOf(ancestor) > -1) {
          replace = false
          nodes.splice(idx, 1)
          break
        }
        ancestor = getParent(ancestor)
      }

      // If the node has been found to be unique, re-insert it.
      if (replace) {
        nodes[idx] = node
      }
    }

    return nodes
  }

  const adapter = {
    isTag,
    existsOne: function (test: (elem: Element) => boolean, elems: Element[]): boolean {
      return elems.some(function (elem) {
        return isTag(elem) ? test(elem) || adapter.existsOne(test, getChildren(elem)) : false
      })
    },
    getSiblings: function (elem: Element): Element[] {
      const parent = getParent(elem)
      return parent ? getChildren(parent) : [elem]
    },
    getChildren: getChildren,
    getParent: getParent,
    getAttributeValue: function (elem: Element, name: string) {
      return elem.attrs?.find((it) => it.name === name)?.value
    },
    hasAttrib: function (elem: Element, name: string) {
      return elem.attrs?.some((it) => it.name === name) ?? false
    },
    removeSubsets: removeSubsets,
    getName: function (elem: Element) {
      return (elem.tagName || '').toLowerCase()
    },
    findOne: function findOne(test: (elem: Element) => boolean, arr: Element[]): Element | null {
      var elem = null

      for (var i = 0, l = arr.length; i < l && !elem; i++) {
        if (test(arr[i])) {
          elem = arr[i]
        } else {
          var childs = getChildren(arr[i])
          if (childs && childs.length > 0) {
            elem = findOne(test, childs)
          }
        }
      }

      return elem
    },
    findAll: function findAll(test: (elem: Element) => boolean, elems: Element[]): Element[] {
      var result: Element[] = []
      for (var i = 0, j = elems.length; i < j; i++) {
        if (!isTag(elems[i])) continue
        if (test(elems[i])) result.push(elems[i])
        var childs = getChildren(elems[i])
        if (childs) result = result.concat(findAll(test, childs))
      }
      return result
    },
    getText: function getText(elem: Node | Node[]): string {
      if (Array.isArray(elem)) return elem.map(getText).join('')

      if (isTag(elem)) return getText(getChildren(elem))

      if (elem.nodeName === '#text') return elem.value as string

      return ''
    },
  }
  return adapter as any
}

export function querySelector(selector: string, context: DefaultTreeAdapterMap['document'] | Element): Element | null {
  return selectOne(selector, context, { adapter: xmldomAdapter() })
}

export function querySelectorAll(selector: string, context: DefaultTreeAdapterMap['document'] | Element): Element[] {
  return selectAll(selector, context, { adapter: xmldomAdapter() })
}

export function getAttribute(elem: Element | null, name: string): string | null {
  if (!elem) {
    return null
  }
  const attr = elem.attrs.find((it) => it.name === name)
  if (!attr) {
    return null
  }
  return attr.value
}

export function setAttribute(elem: Element | null, name: string, value: string): void {
  if (!elem) {
    return
  }
  const attr = elem.attrs.find((it) => it.name === name)
  if (attr) {
    attr.value = value
  } else {
    elem.attrs.push({ name, value })
  }
}

export function getInnerHTML(elem: Document | Element | null): string | null {
  if (!elem) {
    return null
  }
  return serialize(elem)
}

export function getTextContent(elem: Document | Element | null): string | null {
  if (!elem) {
    return null
  }
  let text = ''
  if (elem.nodeName === '#text') {
    text += (elem as unknown as TextNode).value
  }
  if (elem.childNodes) {
    for (const child of elem.childNodes) {
      text += getTextContent(child as Element)
    }
  }
  return text
}

export function getParentElement(elem: Element | null): Element | null {
  if (!elem) {
    return null
  }
  return elem.parentNode as Element | null
}
