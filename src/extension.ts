import * as vscode from 'vscode'
import { fetchData, IStockData } from './service'

const statusBarItemList: vscode.StatusBarItem[] = []
const loopTimer: any = []

/**
 * 插件被激活时触发，所有代码总入口
 * @param {*} context 插件上下文
 */
exports.activate = function (context: any) {
  const bar = createStatusBarItem(0)
  loopFillData(bar, 0)

  // 注册命令
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(function() {
      console.log('stock-sentry: on config change')
      const bar = createStatusBarItem(0)
      loopFillData(bar, 0)
    })
  )
}

/**
 * 插件被释放时触发
 */
exports.deactivate = function () {
  console.log('stock-sentry: on deactivate')
  for (let i = 0; i < loopTimer.length; i++) {
    clearTimeout(loopTimer[i])
  }
}

// 循环更新数据
function loopFillData(bar: vscode.StatusBarItem, index: number) {
  const symbol = getConfig<string>('symbol')

  if (!symbol) {
    bar.hide()
    return
  }

  // 判断展示时间段
  const time = new Date()
  const now = time.getHours() * 100 + time.getMinutes()
  const range = getConfig<string[]>('showTime') || []
  const start = parseInt((range[0] || '9:00').replace(':', ''), 10)
  const end = parseInt((range[1] || '15:30').replace(':', ''), 10)
  if (now < start || now > end) {
    bar.hide()
    setTimeout(() => {
      loopFillData(bar, index)
    }, 1000 * 60)
    return
  }

  // 拉取数据并显示
  fetchData({
    symbol,
    bigVolume: getConfig('bigVolume') || 2000,
    cookie: getConfig('xueqiuCookie'),
  }).then((res) => {
    if (res) {
      fillStatusBarData(bar, res)
    } else {
      bar.text = 'stock-sentry: system error'
      bar.color = 'red'
      bar.show()
    }
    loopTimer[index] = setTimeout(() => {
      loopFillData(bar, index)
    }, getConfig('updateInterval') || 2000)
  })
}

function getConfig<T>(key: string): T {
  const config = vscode.workspace.getConfiguration()
  return config.get('stock-sentry.' + key) as T
}

// 创建一个状态栏
function createStatusBarItem(index: number) {
  if (statusBarItemList[index]) {
    return statusBarItemList[index]
  }

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, index)
  statusBarItemList[index] = bar
  return bar
}

// 填充状态栏数据
function fillStatusBarData(bar: vscode.StatusBarItem, data: IStockData) {
  let text = `「${data.name}」${data.current.toFixed(2)} ${data.chg.toFixed(2)}%`

  if (data.buy.length) {
    text += ` | ↑ ${data.buy[0].p.toFixed(2)} · ${data.buy[0].c}`
  } else {
    text += ` | ↑ ----`
  }

  if (data.sell.length) {
    text += ` | ↓ ${data.sell[0].p.toFixed(2)} · ${data.sell[0].c}`
  } else {
    text += ` | ↓ ----`
  }

  if (data.big.c > 0) {
    text += ` | 💥 ${data.big.s > 0 ? '↑' : '↓'} ${data.big.p.toFixed(2)} · ${data.big.c}`
  }

  bar.text = text
  bar.tooltip = getTooltipData(data)
  bar.color = '#999999'

  bar.show()
}

// 获取tooltip数据
function getTooltipData(data: IStockData) {
  let tooltip = ''
  if (data.sell.length) {
    data.sell.reverse().forEach((d) => {
      const p = (d.p.toFixed(2) + ' '.repeat(10)).substr(0, 10)
      tooltip += `↓ | ${p} | ${d.c}\n`
    })
  }

  tooltip += '----------------------\n'

  if (data.buy.length) {
    data.buy.forEach((d) => {
      const p = (d.p.toFixed(2) + ' '.repeat(10)).substr(0, 10)
      tooltip += `↑ | ${p} | ${d.c}\n`
    })
  }

  return tooltip
}
