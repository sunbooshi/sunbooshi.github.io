'use client';

export default function About() {
    return (
        <div className="flex flex-col items-center">
            <img className="w-70 mt-16" src="/about.svg"></img>
            <div className="w-[320px] lg:w-160">
                <div className="border-gray-300 border border-dashed rounded-xl p-4 text-gray-500 mt-4 mb-4">
                    <p className="text-gray-500 font-bold">
                       2026年7月14日更新：
                    </p>
                    <p className="text-gray-500">
                        tech域名续费太贵，已经注销备案迁移到GitHub Pages了。
                    </p>
                </div>
                <p className="mb-4">
                    从大学时代就开始做个人网站了，直到现在才最终完成！
                </p>
                <p className="mb-4">
                    我还记得当初找各种网络免费的网络空间，二级域名，那时候还不需要备案，我来来回回做了很多网站。
                    但没有一个能坚持下来，最后都因为各种原因，被我给放弃了。
                </p>
                <p className="mb-4">
                    直到2021年，我终于下决心，要重新开始做个人网站，并坚持做下去。在腾讯云购买了域名，申请了备案，然后用极低的成本做了一个静态站。
                </p>
                <p className="mb-4">
                    其实也没有什么内容，主要是自己拍的照片和博客。照片也仅整理了仅两年自己我感觉拍的比较好的，最大的作用就是给别人秀一下。
                </p>
                <p className="mb-4">
                    我也算是践行了自己“靡不有初，鲜克有终！”这句座右铭，终于在2023年8月完成了整站建设！一个历时两年的个人网站！
                </p>
                <p className="mb-4">
                    之前的版本用的是vue，最近改成了用next.js，主要是还想蹭一下vercel的免费服务。回头再部署到vercel上。
                </p>
                <p className="pt-4 mb-4 w-full text-right pr-4">
                    2023年8月14日
                </p>
            </div>
        </div>
    )
}