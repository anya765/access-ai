import {
  Controller,
  Get,
  UploadedFile,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { APIservice } from './API.service';
import { configService } from '../config/configuration';
import { ethers } from 'ethers';

const _ = require('lodash');

@Controller('')
export class APIcontroller {
  constructor(private readonly apiService: APIservice) {
    // this.test();
  }

  private async test() {
    let stringDoc = `The Event Loop in Node.js is a very important part of the process. From the name, we can see it is a loop. The loop starts running as Node.js begins executing a program. In this section, we'll examine what the event loop does.

When we run our JavaScript program that contains some asynchronous code (like I/O instructions or timer-based actions), Node.js handles them using the Node.js APIs. Asynchronous functions usually have instructions to be executed after the function has finished processing. Those instructions are placed in a Callback Queue.

The Callback Queue works with the First In First Out (FIFO) approach. That means the first instruction (callback) to enter the queue is the first to be invoked.

As the event loop runs, it checks if the call stack is empty. If the call stack is not empty, it allows the ongoing process to continue. But if the call stack is empty, it sends the first instruction on the callback queue to the JavaScript engine. The engine then places that instruction (function) on the call stack and executes it. This is very similar to how the event loop works in the browser.

So, the event loop executes callbacks from asynchronous instructions using the JavaScript V8 engine in Node.js. And it is a loop, which means every time it runs, it checks the call stack to know if it will remove the foremost callback and send it to the JavaScript engine.`;
    // stringDoc = 'hello world';
    const bytesDoc = ethers.utils.toUtf8Bytes(stringDoc);

    // console.log('', bytesDoc);

    const res_1 = await this.uploadDocument({
      document: bytesDoc,
      company: '',
      tone: '',
      response: '',
      color: '',
      url: '',
    });

    const sessionRes = await this.generateSessionId({
      setupToken: res_1['setupToken'],
    });

    const chatRes = await this.continueChat({
      sessionToken: sessionRes.sessionToken,
      question: 'Summarise the document text',
    });
    console.log('--> chatRes : \n', chatRes);
  }

  @Post('convert/pdf-to-text')
  @UseInterceptors(FileInterceptor('file'))
  async convert_pdf_to_text(@UploadedFile() file: Express.Multer.File) {
    try {
      return await this.apiService.convert_pdf_to_text(file);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('convert/url-to-text')
  async convert_url_to_text(@Body() Body: { url: string }) {
    try {
      return await this.apiService.convert_url_to_text(Body.url);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('setup')
  async uploadDocument(
    @Body()
    Body: {
      document: any;
      url: string;
      company: string;
      tone: string;
      response: string;
      color: string;
    },
  ) {
    try {
      let document = ethers.utils.toUtf8String(Body?.document);
      const company = Body?.company ? Body?.company : '';
      const tone = Body?.tone ? Body?.tone : '';
      const response = Body?.response ? Body?.response : '';
      const color = Body?.color ? Body?.color : '';

      if (_.size(Body.url) > 0) {
        document = await this.apiService.convert_url_to_text(Body.url);
      }

      return await this.apiService.uploadDocument(
        document,
        company,
        tone,
        response,
        color,
      );
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('session')
  async generateSessionId(@Body() Body: { setupToken: string }) {
    try {
      if (_.size(Body?.setupToken) > 0) {
        return await this.apiService.generateSessionId(Body?.setupToken);
      } else
        throw new HttpException(`setupToken not valid`, HttpStatus.BAD_REQUEST);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('chat')
  async continueChat(@Body() Body: { sessionToken: string; question: string }) {
    try {
      if (_.size(Body?.sessionToken) > 0 && _.size(Body?.question) > 0) {
        return await this.apiService.continueChat(
          Body?.sessionToken,
          Body?.question,
        );
      } else
        throw new HttpException(
          `sessionToken not valid or question cannot be empty`,
          HttpStatus.BAD_REQUEST,
        );
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('model')
  async models() {
    return 'gpt';
    // return await this.apiService.models();
  }
}
