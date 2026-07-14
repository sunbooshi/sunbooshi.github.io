'use client';

import Image from 'next/image'
import Link from 'next/link'

function Beian() {
  return (
    <div className='absolute bottom-2 text-gray-400 text-sm flex flex-row w-full justify-center'>
      <a href="https://beian.miit.gov.cn/" target="_blank">鲁ICP备2021031765号</a>
      <span>&nbsp;&nbsp;&nbsp;©2023 SunBooShi</span>
    </div>
  )
}
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 w-full justify-center">
      <div className='flex flex-col items-center'>
      <div>
        <Image
                src="/my.png"
                alt="My"
                className="dark:invert"
                width={647}
                height={319}
                priority
              />
      </div>
      <div className='py-8'>
       <Image
              src="/logo.svg"
              alt="Logo"
              className="dark:invert"
              width={220}
              height={36}
              priority
            />
      </div>
    

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-4 lg:text-left">
        <Link href="/photo"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800 hover:dark:bg-opacity-30"
          >
          <h2 className={`text-2xl`}>
            Photo{' '}
          </h2>
        </Link>

        <a
          href="https://sun.booshi.tech/blog/index.html"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800 hover:dark:bg-opacity-30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`text-2xl`}>
            Blog{' '}
          </h2>
        </a>

        <a
          href="https://github.com/sunbooshi"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`text-2xl`}>
            GitHub{' '}
          </h2>
        </a>

        <Link href="/about"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800 hover:dark:bg-opacity-30"
          >
          <h2 className={`text-2xl`}>
            About
          </h2>
        </Link>
      </div>

      </div>
      <Beian />
    </main>
  )
}
