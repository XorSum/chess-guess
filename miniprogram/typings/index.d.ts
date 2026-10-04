// 微信小程序全局类型（最小集，供 DevTools TS 编译插件与本仓库 tsc 共用）。
// TS 6.0 下 Page({}) 的 this 会推断为 unknown，用 ThisType 泛型声明解决。

interface WxPageInstance {
  data: any;
  setData(data: Record<string, unknown>, callback?: () => void): void;
}

declare function App<T extends Record<string, any>>(options: T & ThisType<T>): void;
declare function Page<T extends Record<string, any>>(
  options: T & ThisType<T & WxPageInstance>,
): void;
declare function getApp<T = Record<string, any>>(): T;
declare function getCurrentPages(): any[];

// 小程序运行时提供 CommonJS require（用于加载生成的大数据文件）
declare function require(path: string): any;

// 小程序运行时的全局定时器（无 DOM lib）
declare function setTimeout(
  callback: (...args: any[]) => void,
  ms?: number,
  ...args: any[]
): number;
declare function clearTimeout(id: number): void;

interface WxSelectorQuery {
  select(selector: string): this;
  fields(config: { node?: boolean; size?: boolean; id?: boolean }): this;
  exec(callback: (res: any[]) => void): void;
}

interface Wx {
  getStorageSync(key: string): any;
  setStorageSync(key: string, value: any): void;
  getWindowInfo(): { windowWidth: number; windowHeight: number; pixelRatio: number };
  createSelectorQuery(): WxSelectorQuery;
}

declare const wx: Wx;
