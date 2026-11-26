import type { Locale } from "../../i18n";

export type Category =
  | "Geography"
  | "Science"
  | "Art"
  | "Sport"
  | "History"
  | "Music"
  | "Nature"
  | "Numbers"
  | "Books"
  | "Body"
  | "Food"
  | "Language";

type Text = { q: string; a: [string, string, string, string] };

export interface Question extends Record<Locale, Text> {
  /** Index of the correct answer, the same in every language. */
  c: number;
  cat: Category;
}

export const QUESTIONS: Question[] = [
  {
    c: 2,
    cat: "Geography",
    en: { q: "What is the capital of Australia?", a: ["Sydney", "Melbourne", "Canberra", "Perth"] },
    ko: { q: "오스트레일리아의 수도는 어디일까요?", a: ["시드니", "멜버른", "캔버라", "퍼스"] },
  },
  {
    c: 1,
    cat: "Science",
    en: { q: "Which planet is the largest in the solar system?", a: ["Saturn", "Jupiter", "Neptune", "Uranus"] },
    ko: { q: "태양계에서 가장 큰 행성은 무엇일까요?", a: ["토성", "목성", "해왕성", "천왕성"] },
  },
  {
    c: 2,
    cat: "Science",
    en: { q: "What is the chemical symbol for gold?", a: ["Go", "Gd", "Au", "Ag"] },
    ko: { q: "금의 원소 기호는 무엇일까요?", a: ["Go", "Gd", "Au", "Ag"] },
  },
  {
    c: 0,
    cat: "Art",
    en: { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Donatello"] },
    ko: { q: "모나리자를 그린 사람은 누구일까요?", a: ["레오나르도 다빈치", "라파엘로", "미켈란젤로", "도나텔로"] },
  },
  {
    c: 3,
    cat: "Geography",
    en: { q: "Which is the largest ocean on Earth?", a: ["Atlantic", "Indian", "Arctic", "Pacific"] },
    ko: { q: "지구에서 가장 넓은 바다는 어디일까요?", a: ["대서양", "인도양", "북극해", "태평양"] },
  },
  {
    c: 2,
    cat: "Sport",
    en: { q: "How many players from one team are on a soccer field at kickoff?", a: ["9", "10", "11", "12"] },
    ko: { q: "축구 경기 시작 때 한 팀에서 경기장에 나서는 선수는 몇 명일까요?", a: ["9", "10", "11", "12"] },
  },
  {
    c: 1,
    cat: "Science",
    en: { q: "Which gas do plants absorb from the air?", a: ["Oxygen", "Carbon dioxide", "Hydrogen", "Helium"] },
    ko: { q: "식물이 공기에서 흡수하는 기체는 무엇일까요?", a: ["산소", "이산화탄소", "수소", "헬륨"] },
  },
  {
    c: 2,
    cat: "Geography",
    en: { q: "Which river runs through Paris?", a: ["Rhine", "Loire", "Seine", "Danube"] },
    ko: { q: "파리를 가로지르는 강은 무엇일까요?", a: ["라인강", "루아르강", "센강", "도나우강"] },
  },
  {
    c: 2,
    cat: "Science",
    en: { q: "What is the hardest natural substance?", a: ["Quartz", "Steel", "Diamond", "Granite"] },
    ko: { q: "자연에서 가장 단단한 물질은 무엇일까요?", a: ["석영", "강철", "다이아몬드", "화강암"] },
  },
  {
    c: 0,
    cat: "History",
    en: {
      q: "Which country gave the Statue of Liberty to the United States?",
      a: ["France", "Spain", "Italy", "Portugal"],
    },
    ko: { q: "미국에 자유의 여신상을 선물한 나라는 어디일까요?", a: ["프랑스", "스페인", "이탈리아", "포르투갈"] },
  },
  {
    c: 2,
    cat: "Music",
    en: { q: "How many strings does a standard guitar have?", a: ["4", "5", "6", "7"] },
    ko: { q: "일반적인 기타의 줄은 몇 개일까요?", a: ["4", "5", "6", "7"] },
  },
  {
    c: 1,
    cat: "Science",
    en: { q: "Which element has the symbol O?", a: ["Osmium", "Oxygen", "Gold", "Oganesson"] },
    ko: { q: "원소 기호가 O인 원소는 무엇일까요?", a: ["오스뮴", "산소", "금", "오가네손"] },
  },
  {
    c: 1,
    cat: "Nature",
    en: { q: "What is the largest mammal alive today?", a: ["African elephant", "Blue whale", "Giraffe", "Orca"] },
    ko: { q: "현재 살아 있는 가장 큰 포유류는 무엇일까요?", a: ["아프리카코끼리", "대왕고래", "기린", "범고래"] },
  },
  {
    c: 2,
    cat: "History",
    en: { q: "In which country are the pyramids of Giza?", a: ["Sudan", "Mexico", "Egypt", "Peru"] },
    ko: { q: "기자의 피라미드는 어느 나라에 있을까요?", a: ["수단", "멕시코", "이집트", "페루"] },
  },
  {
    c: 2,
    cat: "Numbers",
    en: { q: "How many degrees are in a right angle?", a: ["45", "60", "90", "180"] },
    ko: { q: "직각은 몇 도일까요?", a: ["45", "60", "90", "180"] },
  },
  {
    c: 1,
    cat: "Books",
    en: {
      q: "Who wrote the play Romeo and Juliet?",
      a: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Oscar Wilde"],
    },
    ko: {
      q: "희곡 로미오와 줄리엣을 쓴 사람은 누구일까요?",
      a: ["찰스 디킨스", "윌리엄 셰익스피어", "제인 오스틴", "오스카 와일드"],
    },
  },
  {
    c: 2,
    cat: "Science",
    en: { q: "Which planet is known as the Red Planet?", a: ["Venus", "Mercury", "Mars", "Pluto"] },
    ko: { q: "붉은 행성이라 불리는 행성은 무엇일까요?", a: ["금성", "수성", "화성", "명왕성"] },
  },
  {
    c: 2,
    cat: "Geography",
    en: { q: "What is the currency of Japan?", a: ["Won", "Yuan", "Yen", "Baht"] },
    ko: { q: "일본의 화폐 단위는 무엇일까요?", a: ["원", "위안", "엔", "바트"] },
  },
  {
    c: 1,
    cat: "Numbers",
    en: { q: "How many sides does a hexagon have?", a: ["5", "6", "7", "8"] },
    ko: { q: "육각형의 변은 몇 개일까요?", a: ["5", "6", "7", "8"] },
  },
  {
    c: 2,
    cat: "Numbers",
    en: { q: "What is the smallest prime number?", a: ["0", "1", "2", "3"] },
    ko: { q: "가장 작은 소수는 무엇일까요?", a: ["0", "1", "2", "3"] },
  },
  {
    c: 0,
    cat: "Science",
    en: { q: "At what temperature in Celsius does water freeze?", a: ["0", "10", "32", "100"] },
    ko: { q: "물은 섭씨 몇 도에서 얼까요?", a: ["0", "10", "32", "100"] },
  },
  {
    c: 1,
    cat: "Science",
    en: { q: "Which metal is liquid at room temperature?", a: ["Lead", "Mercury", "Tin", "Zinc"] },
    ko: { q: "상온에서 액체 상태인 금속은 무엇일까요?", a: ["납", "수은", "주석", "아연"] },
  },
  {
    c: 2,
    cat: "Geography",
    en: { q: "On which continent is the Sahara desert?", a: ["Asia", "Australia", "Africa", "South America"] },
    ko: { q: "사하라 사막은 어느 대륙에 있을까요?", a: ["아시아", "오스트레일리아", "아프리카", "남아메리카"] },
  },
  {
    c: 3,
    cat: "Body",
    en: { q: "Which organ pumps blood around your body?", a: ["Lungs", "Liver", "Kidney", "Heart"] },
    ko: { q: "몸 전체에 피를 보내는 기관은 무엇일까요?", a: ["폐", "간", "콩팥", "심장"] },
  },
  {
    c: 1,
    cat: "Body",
    en: { q: "How many bones are in the adult human body?", a: ["186", "206", "226", "246"] },
    ko: { q: "성인의 뼈는 몇 개일까요?", a: ["186", "206", "226", "246"] },
  },
  {
    c: 2,
    cat: "Geography",
    en: { q: "Which country has the largest land area?", a: ["Canada", "China", "Russia", "United States"] },
    ko: { q: "국토 면적이 가장 넓은 나라는 어디일까요?", a: ["캐나다", "중국", "러시아", "미국"] },
  },
  {
    c: 1,
    cat: "Science",
    en: {
      q: "Who developed the theory of general relativity?",
      a: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Galileo Galilei"],
    },
    ko: {
      q: "일반 상대성 이론을 세운 사람은 누구일까요?",
      a: ["아이작 뉴턴", "알베르트 아인슈타인", "닐스 보어", "갈릴레오 갈릴레이"],
    },
  },
  {
    c: 3,
    cat: "Body",
    en: {
      q: "Which vitamin does sunlight help your body produce?",
      a: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"],
    },
    ko: {
      q: "햇빛을 받으면 몸에서 만들어지는 비타민은 무엇일까요?",
      a: ["비타민 A", "비타민 B12", "비타민 C", "비타민 D"],
    },
  },
  {
    c: 1,
    cat: "Geography",
    en: { q: "What is the capital of Canada?", a: ["Toronto", "Ottawa", "Vancouver", "Montreal"] },
    ko: { q: "캐나다의 수도는 어디일까요?", a: ["토론토", "오타와", "밴쿠버", "몬트리올"] },
  },
  {
    c: 2,
    cat: "Numbers",
    en: { q: "How many colours are traditionally listed in a rainbow?", a: ["5", "6", "7", "9"] },
    ko: { q: "무지개는 흔히 몇 가지 색으로 이야기할까요?", a: ["5", "6", "7", "9"] },
  },
  {
    c: 0,
    cat: "Nature",
    en: { q: "Which is the fastest land animal?", a: ["Cheetah", "Pronghorn", "Lion", "Greyhound"] },
    ko: { q: "땅 위에서 가장 빠른 동물은 무엇일까요?", a: ["치타", "가지뿔영양", "사자", "그레이하운드"] },
  },
  {
    c: 1,
    cat: "Geography",
    en: { q: "Which ocean lies to the east of the United States?", a: ["Pacific", "Atlantic", "Indian", "Southern"] },
    ko: { q: "미국의 동쪽에 있는 바다는 어디일까요?", a: ["태평양", "대서양", "인도양", "남극해"] },
  },
  {
    c: 2,
    cat: "Music",
    en: { q: "Which instrument has 88 keys?", a: ["Organ", "Harpsichord", "Piano", "Accordion"] },
    ko: { q: "건반이 88개인 악기는 무엇일까요?", a: ["오르간", "하프시코드", "피아노", "아코디언"] },
  },
  {
    c: 1,
    cat: "Sport",
    en: { q: "Which country hosted the 2016 Summer Olympics?", a: ["China", "Brazil", "Japan", "Greece"] },
    ko: { q: "2016년 하계 올림픽을 연 나라는 어디일까요?", a: ["중국", "브라질", "일본", "그리스"] },
  },
  {
    c: 2,
    cat: "Numbers",
    en: { q: "How many minutes are in a full day?", a: ["720", "1200", "1440", "2400"] },
    ko: { q: "하루는 몇 분일까요?", a: ["720", "1200", "1440", "2400"] },
  },
  {
    c: 0,
    cat: "Body",
    en: { q: "What is the largest internal organ in the human body?", a: ["Liver", "Brain", "Stomach", "Lung"] },
    ko: { q: "사람 몸속에서 가장 큰 장기는 무엇일까요?", a: ["간", "뇌", "위", "폐"] },
  },
  {
    c: 1,
    cat: "Science",
    en: { q: "Which gas makes up most of Earth's atmosphere?", a: ["Oxygen", "Nitrogen", "Argon", "Carbon dioxide"] },
    ko: { q: "지구 대기의 대부분을 이루는 기체는 무엇일까요?", a: ["산소", "질소", "아르곤", "이산화탄소"] },
  },
  {
    c: 2,
    cat: "History",
    en: {
      q: "Who was the first person to walk on the moon?",
      a: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"],
    },
    ko: {
      q: "달 위를 처음 걸은 사람은 누구일까요?",
      a: ["버즈 올드린", "유리 가가린", "닐 암스트롱", "마이클 콜린스"],
    },
  },
  {
    c: 1,
    cat: "Numbers",
    en: { q: "How many zeroes are in one million?", a: ["5", "6", "7", "9"] },
    ko: { q: "100만에는 0이 몇 개 있을까요?", a: ["5", "6", "7", "9"] },
  },
  {
    c: 1,
    cat: "Nature",
    en: { q: "Which bird is a common symbol of peace?", a: ["Eagle", "Dove", "Swan", "Crane"] },
    ko: { q: "평화의 상징으로 흔히 쓰이는 새는 무엇일까요?", a: ["독수리", "비둘기", "백조", "두루미"] },
  },
  {
    c: 2,
    cat: "Food",
    en: { q: "What is the main ingredient in guacamole?", a: ["Cucumber", "Pea", "Avocado", "Courgette"] },
    ko: { q: "과카몰리의 주재료는 무엇일까요?", a: ["오이", "완두콩", "아보카도", "애호박"] },
  },
  {
    c: 0,
    cat: "Science",
    en: { q: "Which planet orbits closest to the sun?", a: ["Mercury", "Venus", "Earth", "Mars"] },
    ko: { q: "태양에 가장 가까이 도는 행성은 무엇일까요?", a: ["수성", "금성", "지구", "화성"] },
  },
  {
    c: 1,
    cat: "Geography",
    en: {
      q: "The Great Barrier Reef lies off the coast of which country?",
      a: ["Indonesia", "Australia", "Philippines", "Fiji"],
    },
    ko: {
      q: "그레이트배리어리프는 어느 나라 앞바다에 있을까요?",
      a: ["인도네시아", "오스트레일리아", "필리핀", "피지"],
    },
  },
  {
    c: 2,
    cat: "Numbers",
    en: { q: "How many letters are in the English alphabet?", a: ["24", "25", "26", "28"] },
    ko: { q: "영어 알파벳은 몇 글자일까요?", a: ["24", "25", "26", "28"] },
  },
  {
    c: 1,
    cat: "Sport",
    en: { q: "Which sport is played with a shuttlecock?", a: ["Squash", "Badminton", "Tennis", "Pickleball"] },
    ko: { q: "셔틀콕으로 하는 운동은 무엇일까요?", a: ["스쿼시", "배드민턴", "테니스", "피클볼"] },
  },
  {
    c: 3,
    cat: "Science",
    en: { q: "Which metal is the best conductor of electricity?", a: ["Copper", "Gold", "Aluminium", "Silver"] },
    ko: { q: "전기가 가장 잘 통하는 금속은 무엇일까요?", a: ["구리", "금", "알루미늄", "은"] },
  },
  {
    c: 2,
    cat: "Geography",
    en: { q: "Mount Everest sits in which mountain range?", a: ["Andes", "Alps", "Himalayas", "Rockies"] },
    ko: { q: "에베레스트산은 어느 산맥에 있을까요?", a: ["안데스산맥", "알프스산맥", "히말라야산맥", "로키산맥"] },
  },
  {
    c: 1,
    cat: "Numbers",
    en: { q: "How many faces does a cube have?", a: ["4", "6", "8", "12"] },
    ko: { q: "정육면체의 면은 몇 개일까요?", a: ["4", "6", "8", "12"] },
  },
  {
    c: 3,
    cat: "Language",
    en: { q: "Which language has the most native speakers?", a: ["English", "Spanish", "Hindi", "Mandarin Chinese"] },
    ko: { q: "모국어로 쓰는 사람이 가장 많은 언어는 무엇일까요?", a: ["영어", "스페인어", "힌디어", "중국어(표준어)"] },
  },
  {
    c: 1,
    cat: "Nature",
    en: { q: "What is the tallest animal in the world?", a: ["Elephant", "Giraffe", "Camel", "Moose"] },
    ko: { q: "세상에서 키가 가장 큰 동물은 무엇일까요?", a: ["코끼리", "기린", "낙타", "무스"] },
  },
  {
    c: 1,
    cat: "Geography",
    en: { q: "Which sea is the saltiest large body of water?", a: ["Red Sea", "Dead Sea", "Black Sea", "Baltic Sea"] },
    ko: { q: "큰 바다·호수 가운데 가장 짠 곳은 어디일까요?", a: ["홍해", "사해", "흑해", "발트해"] },
  },
  {
    c: 0,
    cat: "Books",
    en: {
      q: "Who wrote the novel Pride and Prejudice?",
      a: ["Jane Austen", "Emily Bronte", "Mary Shelley", "George Eliot"],
    },
    ko: {
      q: "소설 오만과 편견을 쓴 사람은 누구일까요?",
      a: ["제인 오스틴", "에밀리 브론테", "메리 셸리", "조지 엘리엇"],
    },
  },
];
