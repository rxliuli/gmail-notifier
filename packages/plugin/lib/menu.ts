export interface ActionMenu {
  id: string
  title: string
  submenus?: SubMenu[]
}
type SubMenu =
  | {
      id: string
      title: string
    }
  | {
      type: 'separator'
    }

export function registerActionMenus(menus: ActionMenu[]) {
  menus.forEach((menu) => {
    browser.contextMenus.create({
      id: menu.id,
      title: menu.title,
      contexts: ['action'],
    })
    if (menu.submenus) {
      menu.submenus.forEach((submenu) => {
        if ('type' in submenu) {
          if (submenu.type === 'separator') {
            browser.contextMenus.create({
              type: 'separator',
              parentId: menu.id,
            })
            return
          }
          throw new Error('Unknown submenu type: ' + submenu.type)
        }
        browser.contextMenus.create({
          id: submenu.id,
          title: submenu.title,
          contexts: ['action'],
          parentId: menu.id,
        })
      })
    }
  })
}
