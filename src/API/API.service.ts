import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import setups from 'src/models/setups';
import sessions from 'src/models/sessions';

import { configService } from '../config/configuration';
import { ulid } from 'ulid';
import * as PDFParser from 'pdf-parse';

const axios = require('axios');
const _ = require('lodash');
const mongoose = require('mongoose');
const cheerio = require('cheerio');

const GPT_KEY = configService.getValue('GPT_KEY');
const OPEN_AI_MODEL = configService.getValue('OPEN_AI_MODEL');

@Injectable()
export class APIservice {
  constructor() {}

  public async convert_url_to_text(url: string) {
    try {
      const response = await axios.get(
        `https://extractorapi.com/api/v1/extractor/?apikey=${configService.getValue(
          'EXTRACTOR_API_KEY',
        )}&url=${url}`,
      );
      // console.log('\n---> response : \n', response.data.text);
      return response.data.text;
    } catch (error) {
      console.error(
        'An error occurred while extracting text from the website:',
        error,
      );
      throw error;
    }
  }

  public async convert_pdf_to_text(file: Express.Multer.File) {
    try {
      const pdfBuffer = file.buffer; // Access the file buffer
      const pdfData = await PDFParser(pdfBuffer); // Parse the PDF buffer

      const textContent = pdfData.text; // Extract the text content
      return textContent;
    } catch (e) {}
  }
  public async models() {
    try {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + GPT_KEY,
        },
      });
      return response?.data?.data;
    } catch (e) {
      console.log(e);
    }
  }
  public async uploadDocument(
    document: string,
    company: string,
    tone: string,
    response: string,
    color: string,
  ) {
    try {
      const setupToken = ulid();

      if (_.size(color) == 0) {
        color = '#8D7BAC';
      }

      if (_.size(company) == 0) {
        company = 'Access AI';
      }
      if (_.size(tone) == 0) {
        tone = 'serious';
      }
      if (_.size(response) == 0) {
        response = 'serious';
      }

      await this.connectToMongo();

      const data = {
        token: setupToken,
        response: response,
        tone: tone,
        document: document,
        company: company,
        color: color,
      };

      await setups.create(data);

      const result = {
        success: true,
        reason: '',
        setupToken: setupToken,
      };

      return result;
    } catch (e) {
      console.log(e);
      return HttpStatus.BAD_REQUEST;
    }
  }

  public async generateSessionId(setupToken: string) {
    try {
      await this.connectToMongo();

      const setupData = await setups.findOne({ token: setupToken }).lean();
      if (_.size(setupData) == 0) {
        throw new HttpException(`setupToken not valid`, HttpStatus.BAD_REQUEST);
      } else {
        const sessionToken = ulid();

        const systemQuery =
          'Your name is : ' +
          setupData.company +
          '\nResponse will be in the form of ' +
          setupData.response +
          '\nYour tone will be ' +
          setupData.tone +
          '\nand you have to keep your response concise. A maximum of 6 sentences.' +
          '\nAnother Important thing is that at the end of your each answer you will ask a question to user. Question should be relevant to the chat context.';
        const userQuery =
          '\nI will chat with you and you will answer my question based on the document text that I will provide. Document text is : ' +
          +'``` ' +
          setupData.document +
          ' ```';
        ("\n That's it. Have you understood how I want you to behave in our chat ?");

        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: OPEN_AI_MODEL,
            messages: [
              {
                role: 'system',
                content: systemQuery,
              },
              {
                role: 'user',
                content: userQuery,
              },
            ],
            user: sessionToken,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + GPT_KEY,
            },
          },
        );

        const gptResponse = response?.data?.choices[0]?.message?.content;

        const data = [
          {
            sessionToken: sessionToken,
            setupToken: setupToken,
            system: systemQuery,
            user: [userQuery],
            assistant: [gptResponse],
          },
        ];
        await sessions.insertMany(data);

        return {
          success: true,
          reason: '',
          botName: setupData?.company,
          color: setupData?.color,
          sessionToken: sessionToken,
        };
      }
    } catch (e) {
      console.log(e);
      throw new HttpException(`setupToken not valid`, HttpStatus.BAD_REQUEST);
    }
  }

  public async continueChat(sessionToken: string, question: string) {
    try {
      await this.connectToMongo();

      const allChats = await sessions
        .findOne({ sessionToken: sessionToken })
        .lean();
      const messages = [
        {
          role: 'system',
          content: allChats.system,
        },
      ];

      for (let i = 0; i < _.size(allChats.user); i++) {
        messages.push({
          role: 'user',
          content: allChats.user[i],
        });
        messages.push({
          role: 'assistant',
          content: allChats.assistant[i],
        });
      }
      messages.push({
        role: 'user',
        content: question,
      });

      const res_1 = await this.submitToGPT(messages, sessionToken);

      const res_array = await this._responseSplitter(res_1);

      await sessions.findOneAndUpdate(
        { sessionToken: sessionToken },
        { $push: { user: question, assistant: res_1 } },
      );

      for (let i = 0; i < res_array.length; i++) {
        messages.push({
          role: 'assistant',
          content: res_array[i],
        });
      }

      return messages;
    } catch (e) {
      console.log(e);
      return HttpStatus.BAD_REQUEST;
    }
  }

  private async _responseSplitter(_message: string) {
    try {
      const count = _message.split('. ').length;
      const Messages = _message.split('. ');
      // console.log('--> Messages : ', Messages, ' <---- Messages');
      const finalMessages = [];
      let COUNTER = 0;
      finalMessages.push(Messages[0]);
      for (let i = 1; i < count - 1; i++) {
        if (i % 3 != 0) {
          finalMessages[COUNTER] += '. ' + Messages[i];
        } else {
          COUNTER++;
          finalMessages.push('');

          finalMessages[COUNTER] += Messages[i];
        }
      }
      COUNTER++;
      finalMessages.push('');

      finalMessages[COUNTER] += Messages[count - 1];
      // console.log(
      //   '--> finalMessages : ',
      //   finalMessages,
      //   ' <---- finalMessages',
      // );

      return finalMessages;
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  private async submitToGPT(messages: any[], userId: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPEN_AI_MODEL,
          messages: messages,
          user: userId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + GPT_KEY,
          },
        },
      );

      return response?.data?.choices[0]?.message?.content;
    } catch (e) {
      console.log(e);
      return 'gpt-3.5-turbo-16k did not reply';
    }
  }

  private async connectToMongo() {
    const URI = configService.getValue('MONGO_URL');
    mongoose.set('strictQuery', true);
    await mongoose
      .connect(URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => console.log(''))
      .catch((err) => console.log(err));

    // if (mongoose.connection.readyState === 1) {
    //   console.log('Mongoose is connected');
    // } else {
    //   console.log('Mongoose is not connected');
    // }
  }
  public async delay(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
