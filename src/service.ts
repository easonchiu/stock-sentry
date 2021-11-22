import * as superagent from 'superagent'

export interface IStockData {
  name: string
  code: string
  current: number
  chg: number
  buy: { p: number; c: number }[] // 买1 ~ 买5
  sell: { p: number; c: number }[] // 卖1 ~ 卖5
  big: { p: number; c: number; s: number } // 大单买进/卖出
}

// 获取股票数据
export const fetchData = async (params: { symbol: string; bigVolume: number; cookie: string }) => {
  let symbol = params.symbol.toUpperCase()
  if (symbol.indexOf('SH') !== 0 && symbol.indexOf('SZ') !== 0) {
    symbol = 'SH' + symbol
  }

  try {
    const res: IStockData = {
      name: '',
      code: '',
      current: 0,
      chg: 0,
      buy: [],
      sell: [],
      big: { p: 0, c: 0, s: 0 },
    }

    // 盘口数据
    const sb = symbol.replace('SZ', '1').replace('SH', '0')
    const pkurl = `https://api.money.126.net/data/feed/${sb}?callback=a`
    const pankou = await superagent.get(pkurl)
    if (pankou.body) {
      const ps = JSON.parse(String(pankou.body.slice(2, -2)))
      const data = ps[sb]
      if (!data) {
        return
      }

      res.name = data.name
      res.current = data.price
      res.chg = data.percent * 100

      // 买1 ~ 买5
      for (let i = 1; i < 10; i++) {
        if (data['bid' + i] && data['bidvol' + i]) {
          res.buy.push({ p: data['bid' + i], c: Math.round(data['bidvol' + i] / 100) })
        }
      }

      // 卖1 ~ 卖5
      for (let i = 1; i < 10; i++) {
        if (data['ask' + i] && data['askvol' + i]) {
          res.sell.push({ p: data['ask' + i], c: Math.round(data['askvol' + i] / 100) })
        }
      }
    }

    // 实时成单数据，盯大单用(雪球接口，需要cookie)
    if (params.cookie) {
      const trurl = `https://stock.xueqiu.com/v5/stock/history/trade.json?symbol=${symbol}&count=10`
      const trade = await superagent.get(trurl).set('cookie', params.cookie)

      if (trade.body.data && trade.body.data.items) {
        const items = (trade.body.data.items || []).reverse()

        // 从这一批中，找到最大单
        items.forEach((d: any) => {
          const volume = d.trade_volume / 100
          if (volume > params.bigVolume && volume > res.big.c) {
            res.big = {
              p: d.current,
              c: volume,
              s: d.side,
            }
          }
        })
      }
    }

    return res
  } catch (err) {
    console.log('error::::', err)
  }
}
