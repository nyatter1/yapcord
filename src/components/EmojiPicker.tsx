import React, { useState, useMemo } from 'react';
import { Search, Smile, Heart, User, Dog, Utensils, Gamepad2, Sparkles, Clock, X } from 'lucide-react';

export interface EmojiData {
  emoji: string;
  name: string;
  category: string;
  keywords: string[];
}

export const EMOJI_LIST: EmojiData[] = [
  // Smileys & Emotion
  { emoji: '😀', name: 'Grinning Face', category: 'Smileys', keywords: ['smile', 'happy', 'grin'] },
  { emoji: '😃', name: 'Grinning Face with Big Eyes', category: 'Smileys', keywords: ['happy', 'joy', 'smile'] },
  { emoji: '😄', name: 'Grinning Face with Smiling Eyes', category: 'Smileys', keywords: ['happy', 'laugh', 'smile'] },
  { emoji: '😁', name: 'Beaming Face', category: 'Smileys', keywords: ['teeth', 'smile', 'grin'] },
  { emoji: '😆', name: 'Grinning Squinting Face', category: 'Smileys', keywords: ['lol', 'laugh', 'smile'] },
  { emoji: '😅', name: 'Grinning Face with Sweat', category: 'Smileys', keywords: ['nervous', 'phew', 'sweat'] },
  { emoji: '😂', name: 'Face with Tears of Joy', category: 'Smileys', keywords: ['lmao', 'rofl', 'crying', 'joy'] },
  { emoji: '🤣', name: 'Rolling on the Floor Laughing', category: 'Smileys', keywords: ['rofl', 'lmao', 'lol'] },
  { emoji: '🥲', name: 'Smiling Face with Tear', category: 'Smileys', keywords: ['bittersweet', 'sad', 'smile'] },
  { emoji: '🥹', name: 'Holding Back Tears', category: 'Smileys', keywords: ['pleading', 'emotional', 'touched'] },
  { emoji: '😊', name: 'Smiling Face with Smiling Eyes', category: 'Smileys', keywords: ['blush', 'happy', 'warm'] },
  { emoji: '😇', name: 'Smiling Face with Halo', category: 'Smileys', keywords: ['angel', 'innocent', 'good'] },
  { emoji: '🙂', name: 'Slightly Smiling Face', category: 'Smileys', keywords: ['smile', 'fine', 'okay'] },
  { emoji: '🙃', name: 'Upside-Down Face', category: 'Smileys', keywords: ['silly', 'sarcasm', 'goofy'] },
  { emoji: '😉', name: 'Winking Face', category: 'Smileys', keywords: ['wink', 'flirt', 'secret'] },
  { emoji: '😌', name: 'Relieved Face', category: 'Smileys', keywords: ['peaceful', 'calm', 'phew'] },
  { emoji: '😍', name: 'Smiling Face with Heart-Eyes', category: 'Smileys', keywords: ['love', 'heart', 'adore'] },
  { emoji: '🥰', name: 'Smiling Face with Hearts', category: 'Smileys', keywords: ['in love', 'affection', 'hug'] },
  { emoji: '😘', name: 'Face Blowing a Kiss', category: 'Smileys', keywords: ['kiss', 'love', 'mwah'] },
  { emoji: '😋', name: 'Face Savoring Food', category: 'Smileys', keywords: ['yum', 'delicious', 'tasty'] },
  { emoji: '😜', name: 'Winking Face with Tongue', category: 'Smileys', keywords: ['silly', 'tongue', 'playful'] },
  { emoji: '🤪', name: 'Zany Face', category: 'Smileys', keywords: ['crazy', 'goofy', 'wild'] },
  { emoji: '🤨', name: 'Face with Raised Eyebrow', category: 'Smileys', keywords: ['skeptical', 'suspicious', 'doubt'] },
  { emoji: '🧐', name: 'Face with Monocle', category: 'Smileys', keywords: ['investigate', 'hmm', 'smart'] },
  { emoji: '🤓', name: 'Nerd Face', category: 'Smileys', keywords: ['nerd', 'geek', 'smart', 'glasses'] },
  { emoji: '😎', name: 'Smiling Face with Sunglasses', category: 'Smileys', keywords: ['cool', 'chill', 'sunglasses'] },
  { emoji: '🥳', name: 'Partying Face', category: 'Smileys', keywords: ['party', 'celebrate', 'birthday'] },
  { emoji: '😏', name: 'Smirking Face', category: 'Smileys', keywords: ['smirk', 'sly', 'flirt'] },
  { emoji: '😒', name: 'Unamused Face', category: 'Smileys', keywords: ['meh', 'bored', 'unhappy'] },
  { emoji: '😞', name: 'Disappointed Face', category: 'Smileys', keywords: ['sad', 'bummed', 'upset'] },
  { emoji: '😔', name: 'Pensive Face', category: 'Smileys', keywords: ['thoughtful', 'sad', 'sorry'] },
  { emoji: '🥺', name: 'Pleading Face', category: 'Smileys', keywords: ['puppy eyes', 'please', 'beg'] },
  { emoji: '😭', name: 'Loudly Crying Face', category: 'Smileys', keywords: ['sob', 'cry', 'sad', 'tear'] },
  { emoji: '😤', name: 'Face with Steam From Nose', category: 'Smileys', keywords: ['proud', 'mad', 'frustrated'] },
  { emoji: '😠', name: 'Angry Face', category: 'Smileys', keywords: ['mad', 'annoyed', 'grumpy'] },
  { emoji: '🤬', name: 'Face with Symbols on Mouth', category: 'Smileys', keywords: ['curse', 'rage', 'swear'] },
  { emoji: '🤯', name: 'Exploding Head', category: 'Smileys', keywords: ['mind blown', 'shocked', 'boom'] },
  { emoji: '😳', name: 'Flushed Face', category: 'Smileys', keywords: ['blush', 'shocked', 'embarrassed'] },
  { emoji: '😱', name: 'Face Screaming in Fear', category: 'Smileys', keywords: ['scared', 'scream', 'fear'] },
  { emoji: '💀', name: 'Skull', category: 'Smileys', keywords: ['dead', 'skeleton', 'death', 'dying'] },
  { emoji: '☠️', name: 'Skull and Crossbones', category: 'Smileys', keywords: ['danger', 'poison', 'dead'] },
  { emoji: '💩', name: 'Pile of Poop', category: 'Smileys', keywords: ['poop', 'poo', 'funny'] },
  { emoji: '🤡', name: 'Clown Face', category: 'Smileys', keywords: ['clown', 'fool', 'circus'] },
  { emoji: '👻', name: 'Ghost', category: 'Smileys', keywords: ['boo', 'spooky', 'halloween'] },
  { emoji: '👽', name: 'Alien', category: 'Smileys', keywords: ['space', 'extraterrestrial', 'ufo'] },
  { emoji: '🤖', name: 'Robot', category: 'Smileys', keywords: ['bot', 'ai', 'tech'] },

  // People & Gestures
  { emoji: '👋', name: 'Waving Hand', category: 'People', keywords: ['wave', 'hello', 'bye', 'hi'] },
  { emoji: '🤚', name: 'Raised Back of Hand', category: 'People', keywords: ['stop', 'high five', 'hand'] },
  { emoji: '🖐️', name: 'Hand with Fingers Splayed', category: 'People', keywords: ['five', 'hand', 'splay'] },
  { emoji: '✋', name: 'Raised Hand', category: 'People', keywords: ['stop', 'high five', 'halt'] },
  { emoji: '🖖', name: 'Vulcan Salute', category: 'People', keywords: ['spock', 'star trek', 'peace'] },
  { emoji: '👌', name: 'OK Hand', category: 'People', keywords: ['perfect', 'okay', 'good'] },
  { emoji: '🤌', name: 'Pinched Fingers', category: 'People', keywords: ['italian', 'chef kiss', 'what'] },
  { emoji: '🤏', name: 'Pinching Hand', category: 'People', keywords: ['small', 'little', 'bit'] },
  { emoji: '✌️', name: 'Victory Hand', category: 'People', keywords: ['peace', 'v', 'two'] },
  { emoji: '🤞', name: 'Crossed Fingers', category: 'People', keywords: ['luck', 'hope', 'wish'] },
  { emoji: '🤟', name: 'Love-You Gesture', category: 'People', keywords: ['ily', 'love', 'rock'] },
  { emoji: '🤘', name: 'Sign of the Horns', category: 'People', keywords: ['rock', 'metal', 'horns'] },
  { emoji: '🤙', name: 'Call Me Hand', category: 'People', keywords: ['shaka', 'hang loose', 'phone'] },
  { emoji: '👈', name: 'Backhand Index Pointing Left', category: 'People', keywords: ['point', 'left'] },
  { emoji: '👉', name: 'Backhand Index Pointing Right', category: 'People', keywords: ['point', 'right'] },
  { emoji: '👆', name: 'Backhand Index Pointing Up', category: 'People', keywords: ['point', 'up', 'above'] },
  { emoji: '🖕', name: 'Middle Finger', category: 'People', keywords: ['fu', 'rude', 'finger'] },
  { emoji: '👇', name: 'Backhand Index Pointing Down', category: 'People', keywords: ['point', 'down', 'below'] },
  { emoji: '👍', name: 'Thumbs Up', category: 'People', keywords: ['like', 'approve', 'yes', 'good'] },
  { emoji: '👎', name: 'Thumbs Down', category: 'People', keywords: ['dislike', 'no', 'bad'] },
  { emoji: '✊', name: 'Raised Fist', category: 'People', keywords: ['power', 'fist', 'solidarity'] },
  { emoji: '👊', name: 'Oncoming Fist', category: 'People', keywords: ['punch', 'fist bump', 'bro'] },
  { emoji: '👏', name: 'Clapping Hands', category: 'People', keywords: ['applause', 'bravo', 'clap'] },
  { emoji: '🙌', name: 'Raising Hands', category: 'People', keywords: ['celebrate', 'praise', 'hooray'] },
  { emoji: '🫶', name: 'Heart Hands', category: 'People', keywords: ['love', 'heart', 'appreciation'] },
  { emoji: '👐', name: 'Open Hands', category: 'People', keywords: ['hug', 'open', 'welcome'] },
  { emoji: '🤝', name: 'Handshake', category: 'People', keywords: ['deal', 'agreement', 'meet'] },
  { emoji: '🙏', name: 'Folded Hands', category: 'People', keywords: ['please', 'thank you', 'pray', 'bless'] },
  { emoji: '💪', name: 'Flexed Biceps', category: 'People', keywords: ['strong', 'muscle', 'gym', 'power'] },
  { emoji: '🧠', name: 'Brain', category: 'People', keywords: ['smart', 'think', 'mind'] },
  { emoji: '👁️', name: 'Eye', category: 'People', keywords: ['look', 'see', 'watch'] },

  // Hearts & Symbols
  { emoji: '❤️', name: 'Red Heart', category: 'Hearts', keywords: ['love', 'heart', 'red'] },
  { emoji: '🧡', name: 'Orange Heart', category: 'Hearts', keywords: ['love', 'heart', 'orange'] },
  { emoji: '💛', name: 'Yellow Heart', category: 'Hearts', keywords: ['love', 'heart', 'yellow', 'friend'] },
  { emoji: '💚', name: 'Green Heart', category: 'Hearts', keywords: ['love', 'heart', 'green'] },
  { emoji: '💙', name: 'Blue Heart', category: 'Hearts', keywords: ['love', 'heart', 'blue'] },
  { emoji: '💜', name: 'Purple Heart', category: 'Hearts', keywords: ['love', 'heart', 'purple'] },
  { emoji: '🖤', name: 'Black Heart', category: 'Hearts', keywords: ['love', 'heart', 'black', 'dark'] },
  { emoji: '🤍', name: 'White Heart', category: 'Hearts', keywords: ['love', 'heart', 'white', 'pure'] },
  { emoji: '🤎', name: 'Brown Heart', category: 'Hearts', keywords: ['love', 'heart', 'brown'] },
  { emoji: '💔', name: 'Broken Heart', category: 'Hearts', keywords: ['breakup', 'sad', 'heartbreak'] },
  { emoji: '❣️', name: 'Heart Exclamation', category: 'Hearts', keywords: ['heavy heart', 'love'] },
  { emoji: '💕', name: 'Two Hearts', category: 'Hearts', keywords: ['love', 'pink', 'hearts'] },
  { emoji: '💞', name: 'Revolving Hearts', category: 'Hearts', keywords: ['love', 'spin', 'pink'] },
  { emoji: '💓', name: 'Beating Heart', category: 'Hearts', keywords: ['pulse', 'love', 'thump'] },
  { emoji: '💗', name: 'Growing Heart', category: 'Hearts', keywords: ['expanding', 'love'] },
  { emoji: '💖', name: 'Sparkling Heart', category: 'Hearts', keywords: ['shine', 'love', 'sparkle'] },
  { emoji: '💘', name: 'Heart with Arrow', category: 'Hearts', keywords: ['cupid', 'love', 'arrow'] },
  { emoji: '💝', name: 'Heart with Ribbon', category: 'Hearts', keywords: ['gift', 'love', 'present'] },
  { emoji: '🔥', name: 'Fire', category: 'Hearts', keywords: ['hot', 'flame', 'lit', 'fire'] },
  { emoji: '✨', name: 'Sparkles', category: 'Hearts', keywords: ['shine', 'magic', 'clean', 'star'] },
  { emoji: '🌟', name: 'Glowing Star', category: 'Hearts', keywords: ['star', 'shine', 'favorite'] },
  { emoji: '💯', name: 'Hundred Points', category: 'Hearts', keywords: ['100', 'perfect', 'score', 'real'] },
  { emoji: '⚡', name: 'High Voltage', category: 'Hearts', keywords: ['lightning', 'zap', 'power', 'fast'] },
  { emoji: '💥', name: 'Collision', category: 'Hearts', keywords: ['boom', 'explode', 'impact'] },
  { emoji: '💦', name: 'Sweat Droplets', category: 'Hearts', keywords: ['water', 'splash', 'sweat'] },

  // Animals & Nature
  { emoji: '🐶', name: 'Dog Face', category: 'Animals', keywords: ['puppy', 'dog', 'pet', 'bark'] },
  { emoji: '🐱', name: 'Cat Face', category: 'Animals', keywords: ['kitty', 'cat', 'meow', 'pet'] },
  { emoji: '🐭', name: 'Mouse Face', category: 'Animals', keywords: ['rat', 'mouse', 'rodent'] },
  { emoji: '🐹', name: 'Hamster', category: 'Animals', keywords: ['cute', 'pet', 'rodent'] },
  { emoji: '🐰', name: 'Rabbit Face', category: 'Animals', keywords: ['bunny', 'rabbit', 'easter'] },
  { emoji: '🦊', name: 'Fox', category: 'Animals', keywords: ['fox', 'sly', 'foxy'] },
  { emoji: '🐻', name: 'Bear', category: 'Animals', keywords: ['teddy', 'bear', 'grizzly'] },
  { emoji: '🐼', name: 'Panda', category: 'Animals', keywords: ['bamboo', 'panda', 'cute'] },
  { emoji: '🐻‍❄️', name: 'Polar Bear', category: 'Animals', keywords: ['ice', 'snow', 'bear'] },
  { emoji: '🐨', name: 'Koala', category: 'Animals', keywords: ['australia', 'eucalyptus', 'cute'] },
  { emoji: '🐯', name: 'Tiger Face', category: 'Animals', keywords: ['tiger', 'cat', 'wild'] },
  { emoji: '🦁', name: 'Lion', category: 'Animals', keywords: ['king', 'lion', 'roar'] },
  { emoji: '🐮', name: 'Cow Face', category: 'Animals', keywords: ['moo', 'milk', 'cow'] },
  { emoji: '🐷', name: 'Pig Face', category: 'Animals', keywords: ['oink', 'pork', 'pig'] },
  { emoji: '🐸', name: 'Frog', category: 'Animals', keywords: ['pepe', 'ribbit', 'green'] },
  { emoji: '🐵', name: 'Monkey Face', category: 'Animals', keywords: ['ape', 'chimp', 'banana'] },
  { emoji: '🙈', name: 'See-No-Evil Monkey', category: 'Animals', keywords: ['blind', 'shy', 'monkey'] },
  { emoji: '🙉', name: 'Hear-No-Evil Monkey', category: 'Animals', keywords: ['deaf', 'secret', 'monkey'] },
  { emoji: '🙊', name: 'Speak-No-Evil Monkey', category: 'Animals', keywords: ['oops', 'quiet', 'monkey'] },
  { emoji: '🦄', name: 'Unicorn', category: 'Animals', keywords: ['magic', 'fantasy', 'horse'] },
  { emoji: '🐝', name: 'Honeybee', category: 'Animals', keywords: ['buzz', 'bee', 'honey'] },
  { emoji: '🦋', name: 'Butterfly', category: 'Animals', keywords: ['wings', 'fly', 'pretty'] },
  { emoji: '🌸', name: 'Cherry Blossom', category: 'Animals', keywords: ['flower', 'pink', 'spring'] },
  { emoji: '🌺', name: 'Hibiscus', category: 'Animals', keywords: ['flower', 'tropical', 'hawaii'] },
  { emoji: '🌻', name: 'Sunflower', category: 'Animals', keywords: ['flower', 'yellow', 'sun'] },

  // Food & Drink
  { emoji: '🍕', name: 'Pizza', category: 'Food', keywords: ['cheese', 'slice', 'pepperoni', 'junk food'] },
  { emoji: '🍔', name: 'Hamburger', category: 'Food', keywords: ['burger', 'fast food', 'beef'] },
  { emoji: '🍟', name: 'French Fries', category: 'Food', keywords: ['fries', 'fast food', 'salty'] },
  { emoji: '🌭', name: 'Hot Dog', category: 'Food', keywords: ['sausage', 'fast food', 'bun'] },
  { emoji: '🍿', name: 'Popcorn', category: 'Food', keywords: ['movie', 'snack', 'corn'] },
  { emoji: '🥓', name: 'Bacon', category: 'Food', keywords: ['pork', 'breakfast', 'crispy'] },
  { emoji: '🍳', name: 'Cooking', category: 'Food', keywords: ['egg', 'fry', 'breakfast'] },
  { emoji: '🥞', name: 'Pancakes', category: 'Food', keywords: ['breakfast', 'syrup', 'fluffy'] },
  { emoji: '🧇', name: 'Waffle', category: 'Food', keywords: ['breakfast', 'syrup', 'grid'] },
  { emoji: '🌮', name: 'Taco', category: 'Food', keywords: ['mexican', 'tortilla', 'spicy'] },
  { emoji: '🌯', name: 'Burrito', category: 'Food', keywords: ['mexican', 'wrap', 'rice'] },
  { emoji: '🍜', name: 'Steaming Bowl', category: 'Food', keywords: ['ramen', 'noodles', 'soup'] },
  { emoji: '🍣', name: 'Sushi', category: 'Food', keywords: ['japanese', 'fish', 'rice'] },
  { emoji: '🍩', name: 'Doughnut', category: 'Food', keywords: ['donut', 'sweet', 'glazed'] },
  { emoji: '🍦', name: 'Soft Ice Cream', category: 'Food', keywords: ['cone', 'sweet', 'dessert'] },
  { emoji: '🍰', name: 'Shortcake', category: 'Food', keywords: ['cake', 'slice', 'birthday'] },
  { emoji: '🎂', name: 'Birthday Cake', category: 'Food', keywords: ['candles', 'party', 'celebrate'] },
  { emoji: '☕', name: 'Hot Beverage', category: 'Food', keywords: ['coffee', 'tea', 'cafe', 'morning'] },
  { emoji: '🧋', name: 'Boba Tea', category: 'Food', keywords: ['bubble tea', 'milk tea', 'pearls'] },
  { emoji: '🍺', name: 'Beer Mug', category: 'Food', keywords: ['drink', 'alcohol', 'cheers'] },
  { emoji: '🍻', name: 'Clinking Beer Mugs', category: 'Food', keywords: ['cheers', 'party', 'toast'] },
  { emoji: '🥂', name: 'Clinking Glasses', category: 'Food', keywords: ['champagne', 'celebrate', 'toast'] },

  // Activities & Objects
  { emoji: '🎮', name: 'Video Game', category: 'Objects', keywords: ['game controller', 'ps5', 'xbox', 'gaming'] },
  { emoji: '🕹️', name: 'Joystick', category: 'Objects', keywords: ['arcade', 'retro', 'gaming'] },
  { emoji: '🎲', name: 'Game Die', category: 'Objects', keywords: ['dice', 'luck', 'tabletop'] },
  { emoji: '🎯', name: 'Bullseye', category: 'Objects', keywords: ['target', 'darts', 'goal'] },
  { emoji: '🎨', name: 'Artist Palette', category: 'Objects', keywords: ['art', 'paint', 'draw'] },
  { emoji: '🎬', name: 'Clapper Board', category: 'Objects', keywords: ['movie', 'film', 'cinema'] },
  { emoji: '🎤', name: 'Microphone', category: 'Objects', keywords: ['sing', 'audio', 'mic', 'podcast'] },
  { emoji: '🎧', name: 'Headphone', category: 'Objects', keywords: ['music', 'listen', 'audio'] },
  { emoji: '🎸', name: 'Guitar', category: 'Objects', keywords: ['rock', 'music', 'instrument'] },
  { emoji: '🎹', name: 'Musical Keyboard', category: 'Objects', keywords: ['piano', 'music', 'synth'] },
  { emoji: '📱', name: 'Mobile Phone', category: 'Objects', keywords: ['smartphone', 'iphone', 'text'] },
  { emoji: '💻', name: 'Laptop', category: 'Objects', keywords: ['computer', 'pc', 'code', 'work'] },
  { emoji: '⌨️', name: 'Keyboard', category: 'Objects', keywords: ['typing', 'pc', 'keys'] },
  { emoji: '🖥️', name: 'Desktop Computer', category: 'Objects', keywords: ['pc', 'monitor', 'setup'] },
  { emoji: '💰', name: 'Money Bag', category: 'Objects', keywords: ['cash', 'rich', 'wealth'] },
  { emoji: '💎', name: 'Gem Stone', category: 'Objects', keywords: ['diamond', 'jewel', 'rich'] },
  { emoji: '💣', name: 'Bomb', category: 'Objects', keywords: ['boom', 'explosive', 'blast'] },
  { emoji: '🚀', name: 'Rocket', category: 'Objects', keywords: ['space', 'moon', 'launch', 'fast'] },
  { emoji: '🎉', name: 'Party Popper', category: 'Objects', keywords: ['tada', 'celebrate', 'confetti'] },
  { emoji: '🎁', name: 'Wrapped Gift', category: 'Objects', keywords: ['present', 'birthday', 'surprise'] }
];

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'Smileys', label: 'Smileys & Emotion', icon: Smile },
  { id: 'People', label: 'People & Gestures', icon: User },
  { id: 'Hearts', label: 'Hearts & Effects', icon: Heart },
  { id: 'Animals', label: 'Animals & Nature', icon: Dog },
  { id: 'Food', label: 'Food & Drink', icon: Utensils },
  { id: 'Objects', label: 'Activities & Objects', icon: Gamepad2 }
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredEmojis = useMemo(() => {
    let list = EMOJI_LIST;

    if (selectedCategory !== 'all') {
      list = list.filter((e) => e.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    return list;
  }, [searchQuery, selectedCategory]);

  const categorizedGrouped = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== 'all') {
      return { Search: filteredEmojis };
    }

    const groups: Record<string, EmojiData[]> = {
      'SMILEYS & EMOTION': [],
      'PEOPLE & GESTURES': [],
      'HEARTS & EFFECTS': [],
      'ANIMALS & NATURE': [],
      'FOOD & DRINK': [],
      'ACTIVITIES & OBJECTS': []
    };

    EMOJI_LIST.forEach((e) => {
      if (e.category === 'Smileys') groups['SMILEYS & EMOTION'].push(e);
      else if (e.category === 'People') groups['PEOPLE & GESTURES'].push(e);
      else if (e.category === 'Hearts') groups['HEARTS & EFFECTS'].push(e);
      else if (e.category === 'Animals') groups['ANIMALS & NATURE'].push(e);
      else if (e.category === 'Food') groups['FOOD & DRINK'].push(e);
      else if (e.category === 'Objects') groups['ACTIVITIES & OBJECTS'].push(e);
    });

    return groups;
  }, [filteredEmojis, searchQuery, selectedCategory]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[340px] h-[420px] bg-[#2b2d31] border border-[#1e1f22] rounded-[8px] shadow-2xl flex flex-col overflow-hidden select-none animate-in zoom-in-95 duration-100 z-50 text-[#dbdee1] font-sans"
    >
      {/* Category Tabs Header */}
      <div className="bg-[#1e1f22] px-2 py-1.5 border-b border-[#232428] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-[#35373c] text-[#ff6b00]'
                    : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#2b2d31]'
                }`}
                title={cat.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#949ba4] hover:text-white rounded-[3px] cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="p-2.5 bg-[#2b2d31] border-b border-[#232428] flex-shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find the perfect emoji"
            className="w-full bg-[#1e1f22] text-white placeholder-[#949ba4] text-[13px] rounded-[4px] pl-3 pr-8 py-1.5 outline-none border border-transparent focus:border-[#ff6b00]/50 transition-colors"
          />
          <Search className="w-4 h-4 text-[#949ba4] absolute right-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Scrollable Emojis List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {Object.entries(categorizedGrouped).map(([header, emojis]) => {
          if (!emojis || emojis.length === 0) return null;
          return (
            <div key={header}>
              {header !== 'Search' && (
                <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider mb-1.5 px-1">
                  {header}
                </div>
              )}
              <div className="grid grid-cols-8 gap-1">
                {emojis.map((item, idx) => (
                  <button
                    key={`${item.emoji}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelectEmoji(item.emoji);
                      if (onClose) onClose();
                    }}
                    className="w-8 h-8 rounded-[4px] hover:bg-[#35373c] active:bg-[#3f4248] flex items-center justify-center text-[20px] transition-transform hover:scale-125 cursor-pointer"
                    title={`${item.name} (${item.emoji})`}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {filteredEmojis.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#949ba4]">
            <Smile className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-[13px] font-medium">No emojis found</p>
            <p className="text-[11px] text-[#80848e] mt-1">Try searching for something else</p>
          </div>
        )}
      </div>

      {/* Bottom Discord-style Tip Footer */}
      <div className="px-3 py-2 bg-[#232428] border-t border-[#1e1f22] text-[11px] text-[#949ba4] flex items-center gap-1.5 flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0" />
        <span className="truncate">Tip: Click any emoji to send or react!</span>
      </div>
    </div>
  );
};
