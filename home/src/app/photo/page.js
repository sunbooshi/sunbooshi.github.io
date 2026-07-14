'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image'
import Link from 'next/link';
import { photos } from './photos'


function PhotoWrap({photo}) {
    const originUrl = '/' + photo.file
    const thumb = '/' + photo.thumb
    const camera = photo.camera
    const date = photo.date
    return (
        <div className="w-[320px] lg:w-[480px] border-gray-400 mt-2 mb-8">
            <Link href={originUrl} target='_blank'>
                <Image className="rounded w-[320px] lg:w-[480px]" src={thumb} width={320} height={480} priority alt='img'></Image>
            </Link>
            <div>
                <div className="flex flex-row mt-2 items-center w-full justify-end">
                    <img src="/date.svg" className="w-[16px] h-[16px] mr-2"></img>
                    <div className="mr-4 text-gray-400 text-sm">{date}</div>
                    <img src="/camera.svg" className="w-[16px] h-[16px] mr-2"></img>
                    <div className="mr-4 text-gray-400 text-sm">{camera}</div>
                </div>
            </div>
        </div>
    )
}

export default function Photo() {
    const listItems = photos.map(photo => <PhotoWrap photo={photo} key={photo.file} />);

    return (
        <div className="flex flex-col items-center">
            {listItems}
        </div>
    )
}
