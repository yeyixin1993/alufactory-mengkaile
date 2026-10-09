import base64, io, json, uuid, unittest, zipfile
from unittest.mock import patch
from PIL import Image
import pypdfium2 as pdfium
import test_ai_chat as fixture
from app.ai_attachments import parse_attachments
from app.routes.ai_chat import image_input

def attachment(name,raw,mime='application/octet-stream'):
    return {'name':name,'data':f'data:{mime};base64,'+base64.b64encode(raw).decode()}
def png():
    out=io.BytesIO();Image.new('RGB',(8,8),'red').save(out,format='PNG');return out.getvalue()
def archive(files):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for name,text in files.items():z.writestr(name,text)
    return out.getvalue()

class AttachmentParserTests(unittest.TestCase):
    def test_multiple_images_and_csv(self):
        rows=[attachment('a.png',png(),'image/png'),attachment('b.png',png(),'image/png'),attachment('清单.csv','型号,长度,数量\n2020,1000,2'.encode())]
        saved,images,text=parse_attachments(rows,image_input)
        self.assertEqual(len(saved),3);self.assertEqual(len(images),2);self.assertIn('2020,1000,2',text)
    def test_office(self):
        doc=archive({'word/document.xml':'<w:document xmlns:w="urn:word"><w:p><w:r><w:t>2020 两根</w:t></w:r></w:p></w:document>'})
        sheet=archive({'xl/sharedStrings.xml':'<sst><si><t>2020</t></si></sst>', 'xl/worksheets/sheet1.xml':'<worksheet xmlns="urn:sheet"><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>1000</v></c></row></worksheet>'})
        saved,images,text=parse_attachments([attachment('清单.docx',doc),attachment('清单.xlsx',sheet)],image_input)
        self.assertIn('2020 两根',text);self.assertIn('A1:2020 | B1:1000',text)
    def test_pdf_pages(self):
        pdf=pdfium.PdfDocument.new();pdf.new_page(300,200);pdf.new_page(200,300)
        out=io.BytesIO();pdf.save(out);pdf.close()
        saved,images,text=parse_attachments([attachment('图纸.pdf',out.getvalue())],image_input)
        self.assertEqual(len(images),2);self.assertIn('第2页',text)
    def test_reject_instead_of_truncate(self):
        for rows in [[attachment('a.txt',b'a')]*9,[attachment('a.txt',b'a'*13000)],[attachment('a.exe',b'bad')],[attachment('a.pdf',b'notpdf')],[attachment('a.png',b'bad','image/png')]]:
            with self.assertRaises(ValueError):parse_attachments(rows,image_input)

class AttachmentChatTests(unittest.TestCase):
    setUp=fixture.AIChatTest.setUp
    tearDown=fixture.AIChatTest.tearDown
    headers=fixture.AIChatTest.headers
    status=fixture.AIChatTest.status
    @patch('app.routes.ai_chat.provider_name',return_value='deepseek')
    @patch('app.routes.ai_chat.provider_extract',return_value=(json.dumps(fixture.SPEC),100,{}))
    def test_send_restore_and_retry(self,provider,*_):
        state=self.status().json
        rows=[attachment('正面.png',png(),'image/png'),attachment('背面.png',png(),'image/png'),attachment('需求.txt','都是2020，发天津'.encode())]
        body={'request_id':str(uuid.uuid4()),'message':'综合这些附件报价','attachments':rows,'conversation_id':state['conversation_id']}
        response=self.client.post('/api/ai/chat',headers=self.headers(),json=body)
        self.assertEqual(response.status_code,200,response.json)
        self.assertEqual(len(provider.call_args.args[2]),2)
        self.assertIn('都是2020，发天津',provider.call_args.args[1])
        saved=self.status().json['history'][0]['attachments'];self.assertEqual(len(saved),3)
        self.assertEqual(saved[2]['name'],'需求.txt')
        self.client.post('/api/ai/chat',headers=self.headers(),json=body)
        self.assertEqual(provider.call_count,1)
        body['attachments']=rows[:1]
        self.assertEqual(self.client.post('/api/ai/chat',headers=self.headers(),json=body).status_code,409)
