const vnodeType = {
    HTML: 'HTML',
    TEXT: 'TEXT',
    COMPONENT: 'COMPONENT',
    CLASS_COMPONENT: 'CLASS_COMPONENT'
}
const childType = {
    EMPTY: 'EMPTY',
    SINGLE: 'SINGLE',
    MULTIPLE: 'MULTIPLE'
}

/**
 * 新建虚拟dom
 * @param {*} tag 名称
 * @param {*} data 属性
 * @param {*} children 子节点
 */
function createElement(tag, data, children = null) {
    let flag
    let childrenFlag
    if (typeof tag == 'string') { // 普通的html标签
        flag = vnodeType.HTML
    } else if (typeof tag == 'function') {
        flag = vnodeType.COMPONENT
    } else {
        flag = vnodeType.TEXT
    }
    if (children == null) {
        childrenFlag = childType.EMPTY
    } else if (Array.isArray(children)) {
        let length = children.length
        if (length == 0) {
            childrenFlag = childType.EMPTY
        } else {
            childrenFlag = childType.MULTIPLE
        }
    } else {
        // 其他情况默认为文本
        childrenFlag = childType.SINGLE
        children = createTextVnode(children)
    }

    return {
        flag,   // vnode类型
        tag,    // 标签，div|文本没有tag|组件就是函数
        data,
        key: data && data.key,
        children,
        childrenFlag,
        el: null
    }
}

/**
 * 渲染
 * @param {要渲染的虚拟dom} vnode 
 * @param {容器} container 
 */
function render(vnode, container) {
    // 区分首次渲染和再次渲染
    if(container.vnode) {
        // 更新
        patch(container.vnode, vnode, container)
    }else {
        console.log('aaaa')
        mount(vnode, container)
    }
    container.vnode = vnode
}

/**
 * 更新节点
 * @param {老值} prev 
 * @param {新值} next 
 * @param {容器} container 
 */
function patch(prev, next, container) {
    let nextFlag = next.flag
    let prevFlag = prev.flag
    // 类型不一样，直接替换
    if(nextFlag != prevFlag) {
        replaceNode(prev, next, container)
    } else if(nextFlag == vnodeType.HTML) {
        patchElement(prev, next, container)
    } else if(nextFlag == vnodeType.TEXT) {
        patchText(prev, next)
    }
}

/**
 * 更新元素节点
 * @param {*} prev 
 * @param {*} next 
 * @param {*} container 
 */
function patchElement(prev, next, container) {
    if(prev.tag !== next.tag) {
        replaceNode(prev, next, container)
        return
    }
    let el = (next.el = prev.el)
    let prevData = prev.data
    let nextData = next.data
    // 更新和新建
    if(nextData) {
        for(let key in nextData) {
            let prevVal = prevData[key]
            let nextVal = nextData[key]
            patchData(el, key, prevVal, nextVal)
        }
    }
    // 删除老的
    if(prevData) {
        for(let key in prevData) {
            let prevVal = prevData[key]
            if(prevVal && !nextData.hasOwnProperty(key)) {
                patchData(el, key, prevVal, null)
            }
        }
    }
    // data更新完毕 下面开始更新子元素
    patchChildren(prev.childrenFlag, next.childrenFlag, prev.children, next.children, el)
}

function patchChildren(prevChildFlag, nextChildFlag, prevChildren, nextChildren, container) {
    // 1.老的是单独的，空的，多个
    // 2.新的是单独的，空的，多个
    switch(prevChildFlag) {
        case childType.SINGLE:
            switch(nextChildFlag) {
                case childType.SINGLE:
                    patch(prevChildren, nextChildren, container)
                    break;
                case childType.EMPTY:
                    container.removeChild(prevChildren.el)
                    break
                case childType.MULTIPLE:
                    container.removeChild(prevChildren.el)
                    for(let i=0; i<nextChildren; i++) {
                        mount(nextChildren[i], container)
                    }
                    break
            }
            break
        case childType.EMPTY:
            switch(nextChildFlag) {
                case childType.SINGLE:
                    mount(nextChildren, container)
                    break;
                case childType.EMPTY:
                    break
                case childType.MULTIPLE:
                    for(let i=0; i<nextChildren; i++) {
                        mount(nextChildren[i], container)
                    }
                    break
            }
            break
        case childType.MULTIPLE:
            switch(nextChildFlag) {
                case childType.SINGLE:
                    for(let i=0; i<prevChildren; i++) {
                        container.removeChild(prevChildren[i].el)
                    }
                    mount(nextChildren, container)
                    break;
                case childType.EMPTY:
                    for(let i=0; i<prevChildren; i++) {
                        container.removeChild(prevChildren[i].el)
                    }
                    break
                case childType.MULTIPLE:
                    // 众多虚拟dom就在这里区分，每家优化策略不一样
                    // 不是递增
                    let lastIndex = 0
                    for(let i=0; i<nextChildren.length;i++) {
                        let nextVnode = nextChildren[i]
                        let j = 0
                        let find = false
                        for(j; j<prevChildren.length;j++) {
                            let prevVnode = prevChildren[j]
                            if(prevVnode.key === nextVnode.key) {
                                find = true
                                // key相同，我们认为是同一元素
                                patch(prevVnode, nextVnode, container)
                                if(j < lastIndex) {
                                    let flagNode = nextChildren[i-1].el.nextSibling
                                    container.insertBefore(prevVnode.el, flagNode)
                                    break
                                } else {
                                    lastIndex = j
                                }
                            }
                        }
                        if(!find) {
                            // 需要新增
                            let flagNode = i == 0 ? prevChildren[0].el : nextChildren[i-1].el.nextSibling
                            mount(nextVnode, container, flagNode)
                        }
                    }
                    // 移除不需要的元素
                    for(let i=0; i<prevChildren.length; i++) {
                        const prevVnode = prevChildren[i]
                        const has = nextChildren.find(next => next.key == prevVnode.key)
                        if(!has) {
                            container.removeChild(prevVnode.el)
                        }
                    }
                    break
            }
            break
    }
}

/**
 * 更新文本节点
 * @param {*} prev 
 * @param {*} next 
 */
function patchText(prev, next) {
    let el = (next.el = prev.el)
    if(next.children != prev.children) {
        el.nodeValue = next.children
    }
}

/**
 * 替换节点
 * @param {老值} prev 
 * @param {新值} next 
 * @param {容器} container 
 */
function replaceNode(prev, next, container) {
    container.removeChild(prev,el)
    mount(next, container)
}

/**
 * 首次渲染
 * @param {节点} vnode 
 * @param {容器} container 
 */
function mount(vnode, container, flagNode) {
    let { flag } = vnode
    if (flag == vnodeType.HTML) {
        mountElement(vnode, container, flagNode)
    } else if (flag == vnodeType.TEXT) {
        mountText(vnode, container)
    }
}

/**
 * 渲染HTML元素
 * @param {*} vnode 
 * @param {*} container 
 */
function mountElement(vnode, container, flagNode) {
    let dom = document.createElement(vnode.tag)
    vnode.el = dom
    let { data, children, childrenFlag } = vnode
    if (data) {
        for (let key in data) {
            patchData(dom, key, null, data[key])
        }
    }
    if (childrenFlag !== childType.EMPTY) {
        if (childrenFlag == childType.SINGLE) {
            mount(children, dom)
        } else if (childrenFlag == childType.MULTIPLE) {
            for (let i = 0; i < children.length; i++ ) {
                mount(children[i], dom)
            }
        }
    }
    console.log(dom)
    flagNode ? container.insertBefore(dom, flagNode) : container.appendChild(dom)
}

/**
 * 渲染文本节点
 */
function mountText(vnode, container) {
    let dom = document.createTextNode(vnode.children)
    vnode.el = dom
    container.appendChild(dom)
}

/**
 * 加载数据节点，dom,名称,老值,新值
 */
function patchData(el, key, prev, next) {
    switch(key) {
        case 'style':
            for(let k in next) {
                el.style[k] = next[k]
            }
            for(let k in prev) {
                if(!next.hasOwnProperty(k)) {
                    el.style[k] = ''
                }
            }
            break;
        case 'class':
            el.className = next
            break;
        default:
            if(key[0] === '@') {
                if(prev) {
                    el.removeEventListener(key.slice(1), prev)
                }
                if(next) {
                    el.addEventListener(key.slice(1), next)
                }
            } else {
                el.setAttribute(key, next)
            }
            break;
    }
}

/**
 * 新建文本节点
 * @param {节点} text 
 */
function createTextVnode(text) {
    return {
        flag: vnodeType.TEXT,
        tag: null,
        data: null,
        children: text,
        childrenFlag: childType.EMPTY
    }
}